import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";
import { now } from "../lib/time.js";

export const listNotifications = async (user) => {
  const notifications = await sequelize.query(
    "SELECT * FROM notifications WHERE user_id = :userId ORDER BY id DESC LIMIT 50",
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );

  const [unreadRow] = await sequelize.query(
    "SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = :userId AND read_at IS NULL",
    { replacements: { userId: user.id }, type: QueryTypes.SELECT }
  );

  return { notifications, unread: unreadRow?.c ?? 0 };
};

export const markNotificationsRead = async (user, { ids, all }) => {
  const t = now();

  if (all) {
    await sequelize.query(
      "UPDATE notifications SET read_at = :t WHERE user_id = :userId AND read_at IS NULL",
      { replacements: { t, userId: user.id } }
    );
  } else if (Array.isArray(ids)) {
    for (const id of ids) {
      await sequelize.query(
        "UPDATE notifications SET read_at = :t WHERE id = :id AND user_id = :userId",
        { replacements: { t, id, userId: user.id } }
      );
    }
  }

  return { ok: true };
};

export default { listNotifications, markNotificationsRead };
