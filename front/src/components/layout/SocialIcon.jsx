import { FaInstagram, FaLink, FaTelegram, FaVk, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { SiOdnoklassniki } from "react-icons/si";

const ICON_MAP = {
  vk: FaVk,
  telegram: FaTelegram,
  instagram: FaInstagram,
  youtube: FaYoutube,
  whatsapp: FaWhatsapp,
  ok: SiOdnoklassniki,
  link: FaLink,
};

const SocialIcon = ({ icon, className = "w-5 h-5" }) => {
  const key = String(icon || "link").toLowerCase();
  const Icon = ICON_MAP[key] || FaLink;
  return <Icon className={className} aria-hidden />;
};

export default SocialIcon;
