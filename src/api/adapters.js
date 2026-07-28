function formatGil(value) {
  return `${new Intl.NumberFormat('zh-TW').format(value)} Gil`;
}

function adaptService(service) {
  return {
    id: service.id,
    name: service.serviceName,
    description: service.serviceDescription,
    price: service.priceText || '洽詢店員',
  };
}

export function adaptNavigation(items = []) {
  return items.map((item) => {
    const children = adaptNavigation(item.children);
    const navigationItem = { id: item.id, label: item.label, href: item.routePath };
    return children.length ? { ...navigationItem, children } : navigationItem;
  });
}

export function adaptStaff(staff, detail = false) {
  return {
    id: staff.id,
    nickname: staff.nickname || staff.displayName,
    displayName: staff.displayName,
    role: staff.roleTitle || '',
    isWorkingToday: staff.isWorkingToday !== false,
    todayShift: staff.todayShift || '未排班',
    avatarUrl: staff.avatarUrl,
    intro: staff.shortBio || '',
    detail: detail ? staff.profileBio || staff.shortBio || '' : staff.shortBio || '',
    status: staff.currentStatus,
    statusText: staff.statusText,
    gallery: detail ? (staff.gallery || []).map((item) => item.imageUrl) : [],
    commonServices: (staff.commonServices || []).map(adaptService),
    specialServices: (staff.specialServices || []).map(adaptService),
  };
}

export function adaptGalleryAlbum(album) {
  return {
    id: album.id,
    title: album.albumTitle,
    description: album.albumDescription || '',
    imageUrl: album.coverImageUrl,
    period: album.periodText || '',
    endAt: album.endsAt,
    details: album.details || [],
    photos: (album.items || []).map((item) => ({
      id: item.id,
      imageUrl: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl || item.imageUrl,
      title: item.title || '',
      caption: item.caption || '',
    })),
  };
}

export function adaptMenu(menu) {
  const categories = (menu.categories || []).map((category) => ({
    id: category.id,
    label: category.categoryName,
    intro: category.categoryDescription || '',
    items: (category.items || []).map((item) => ({
      id: item.id,
      name: item.itemName,
      description: item.itemDescription || '',
      price: formatGil(item.price),
      imageUrl: item.imageUrl,
    })),
  }));

  if (menu.sets?.length) {
    categories.push({
      id: 'menu-sets',
      label: '精選套餐',
      intro: '由店內搭配完成的套餐組合。',
      items: menu.sets.map((set) => ({
        id: set.id,
        name: set.setName,
        description: set.setDescription || set.items.map((item) => item.itemName).join('、'),
        price: formatGil(set.setPrice),
        imageUrl: set.imageUrl,
      })),
    });
  }

  return {
    pricing: (menu.pricingRules || []).map((rule) => ({
      id: rule.id,
      name: rule.title,
      price: rule.priceText || '',
      description: rule.description,
    })),
    sections: categories,
  };
}

export function adaptGuestbookComment(comment) {
  return {
    id: comment.id,
    authorId: comment.displayName,
    message: comment.content,
    isPinned: comment.isPinned,
    createdAt: comment.createdAt,
    replies: (comment.replies || []).map((reply) => ({
      id: reply.id,
      authorId: reply.displayName,
      message: reply.content,
      createdAt: reply.createdAt,
    })),
  };
}

export function formatScheduleTime(value, baseDate) {
  const date = new Date(value);
  const base = new Date(baseDate);
  let hour = date.getHours();
  if (date.toDateString() !== base.toDateString()) hour += 24;
  return `${String(hour).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
