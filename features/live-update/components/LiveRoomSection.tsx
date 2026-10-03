"use client";

import { useMemo, useState } from "react";
import type { Room } from "@/features/rooms/types";
import type { LiveRoomStatus } from "@/features/site/types";

type LiveRoomSectionProps = {
  rooms: LiveRoomStatus[];
  catalog: Room[];
};

function RoomThumbnail({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);

  return src && !failed ? (
    <img
      src={src}
      alt={`${name} 包廂實景`}
      width={84}
      height={84}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="live-room-photo-empty">
      {failed ? "照片暫無法載入" : "尚無照片"}
    </span>
  );
}

export default function LiveRoomSection({ rooms, catalog }: LiveRoomSectionProps) {
  const photosById = useMemo(() => new Map(catalog.map((room) => [
    room.id,
    [...room.photos].sort((a, b) => a.sortOrder - b.sortOrder)
      .find((photo) => photo.imageUrl.trim())?.imageUrl,
  ])), [catalog]);

  return (
    <section className="live-room-status">
      <header>
        <div><span>ROOM STATUS</span><h2>包廂目前狀態</h2></div>
        <b>{String(rooms.length).padStart(2, "0")} ROOMS</b>
      </header>
      {rooms.length ? (
        <div className="live-room-grid">
          {rooms.map((room, index) => {
            const photo = photosById.get(room.id);
            const ownership = room.ownershipType === "dedicated"
              ? `店員專屬 · ${room.ownerStaffName || "指定店員"}`
              : "店內共用";

            return (
              <article key={room.id}>
                <div className="live-room-photo">
                  <RoomThumbnail key={photo || "empty"} src={photo} name={room.roomName} />
                  <span className="live-room-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="live-room-copy">
                  <h3>{room.roomName}</h3>
                  <small>{ownership}</small>
                  <strong className={`live-room-badge is-${room.currentStatus}`}>
                    <span className={`live-room-dot is-${room.currentStatus}`} aria-hidden="true"><i /></span>
                    {room.statusText}
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="timeline-empty">
          <span>NO ROOM STATUS</span><strong>今晚尚無公開包廂狀態</strong>
          <p>包廂資料完成設定後會在這裡顯示。</p>
        </div>
      )}
    </section>
  );
}
