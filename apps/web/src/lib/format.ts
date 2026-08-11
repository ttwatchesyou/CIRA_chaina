const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

export function formatRelativeTime(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} วันที่แล้ว`;
  return formatDate(date);
}
