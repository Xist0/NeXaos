import { ROLES } from "./constants";

export const canAccessRole = (role, allowed) => {
  if (!allowed.length) return true;
  if (!role) return false;
  return allowed.includes(role);
};

export const roleLabel = (role) => {
  switch (role) {
    case ROLES.ADMIN:
      return "Администратор";
    case ROLES.MANAGER:
      return "Менеджер";
    default:
      return "Пользователь";
  }
};

