const eventStatusLabels = {
  active: '生效中',
  scheduled: '未開始',
  ended: '已失效',
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

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

export function adaptEvent(event) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    imageUrl: event.coverImageUrl,
    startsAt: event.startsAt,
    endAt: event.endsAt,
    period: `${formatDate(event.startsAt)} - ${formatDate(event.endsAt)}`,
    status: eventStatusLabels[event.status] || event.status,
    details: event.details || [],
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
      imageUrl: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl || item.imageUrl,
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
