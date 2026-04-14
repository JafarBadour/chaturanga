import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  BarChart3,
  BellRing,
  CreditCard,
  FileText,
  FolderTree,
  Globe,
  HomeIcon,
  Image,
  Inbox,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import "./SideBar.css";

const user = { username: "John Doe", email: "Johndoe@gmail.com", img: "" };

export const SideBar = () => {
  const SIDEBAR_SECTIONS = {
    DASHBOARD: "dashboard",
    MANAGEMENT: "management",
    CONTENT: "content",
    COMMUNICATION: "cmmunication",
    SETTINGS: "settings",
  };

  const [isSelected, setIsSelected] = useState(null);

  const toggle = (item) => {
    setIsSelected((prev) => (prev === item ? null : item));
  };

  return (
    // here we add btns to the side bar
    <aside className="side-bar">
      <div className="logo">
        <img src="website-logo.png" alt="website-logo" />
      </div>

      <Link to="/" className="icon">
        <HomeIcon />
      </Link>

      <button
        className="icon"
        onClick={() => toggle(SIDEBAR_SECTIONS.DASHBOARD)}
        aria-expanded={isSelected === SIDEBAR_SECTIONS.DASHBOARD}
      >
        <LayoutDashboard />
      </button>

      <button
        className="icon"
        onClick={() => toggle(SIDEBAR_SECTIONS.MANAGEMENT)}
        aria-expanded={isSelected === SIDEBAR_SECTIONS.MANAGEMENT}
      >
        <Users />
      </button>

      <button
        className="icon"
        onClick={() => toggle(SIDEBAR_SECTIONS.CONTENT)}
        aria-expanded={isSelected === SIDEBAR_SECTIONS.CONTENT}
      >
        <FolderTree />
      </button>

      <button
        className="icon"
        onClick={() => toggle(SIDEBAR_SECTIONS.COMMUNICATION)}
        aria-expanded={isSelected === SIDEBAR_SECTIONS.COMMUNICATION}
      >
        <Mail />
      </button>

      <button
        className="icon"
        onClick={() => toggle(SIDEBAR_SECTIONS.SETTINGS)}
        aria-expanded={isSelected === SIDEBAR_SECTIONS.SETTINGS}
      >
        <Settings />
      </button>

      {/* Other side bar btns will go here later ....*/}

      <div className="user-img">
        <img src={user.img || "avatar.png"} alt="user image" />
      </div>

      {/* here we add items to the expanded section */}

      {isSelected === SIDEBAR_SECTIONS.DASHBOARD && (
        <ExpandedSection title="Dashboard">
          <ExpandedItem icon={<BarChart3 />} label={"Overview"} />
          <ExpandedItem icon={<BellRing />} label={"Notifications"} />
          <ExpandedItem icon={<Zap />} label={"Modes"} link={"/modes"} />
        </ExpandedSection>
      )}

      {isSelected === SIDEBAR_SECTIONS.MANAGEMENT && (
        <ExpandedSection title="Management">
          <ExpandedItem icon={<UserCircle />} label={"My Data"} />
          <ExpandedItem icon={<ShieldCheck />} label={"Permissions"} />
          <ExpandedItem icon={<UserPlus />} label={"Invite Frinds"} />
        </ExpandedSection>
      )}

      {isSelected === SIDEBAR_SECTIONS.CONTENT && (
        <ExpandedSection title="Content">
          <ExpandedItem icon={<FileText />} label={"All Docs"} />
          <ExpandedItem icon={<BellRing />} label={"Notifications"} />
          <ExpandedItem icon={<Image />} label={"Media Library"} />
          <ExpandedItem icon={<Archive />} label={"Archive"} />
        </ExpandedSection>
      )}

      {isSelected === SIDEBAR_SECTIONS.COMMUNICATION && (
        <ExpandedSection title="Communication">
          <ExpandedItem icon={<Inbox />} label={"Inbox"} />
          <ExpandedItem icon={<MessageSquare />} label={"Messages"} />
        </ExpandedSection>
      )}

      {isSelected === SIDEBAR_SECTIONS.SETTINGS && (
        <ExpandedSection title="Setting">
          <ExpandedItem icon={<CreditCard />} label={"Billing"} />
          <ExpandedItem icon={<Globe />} label={"Localization"} />
          <ExpandedItem icon={<Key />} label={"API Keys"} />
        </ExpandedSection>
      )}
    </aside>
  );
  /* Other expanded side bar lists will go here later .... */
};

const ExpandedSection = ({ title, children }) => {
  return (
    <div className="expanded">
      <span className="expanded-title">{title}</span>

      {children}

      <div className="user-info">
        <span>{user.username || "John Doe"}</span>
        <p>{user.email || "Johndoe@gmail.com"}</p>

        <Link to="/logout" className="logout-btn">
          <LogOut />
        </Link>
      </div>
    </div>
  );
};

const ExpandedItem = ({ icon, label, link }) => {
  if (!link) {
    return (
      <div className="expanded-item">
        {icon}
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="expanded-item">
      <Link to={link}>
        {icon}
        <span>{label}</span>
      </Link>
    </div>
  );
};
