import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faSignOutAlt,
  faUserCircle,
  faCaretDown,
} from "@fortawesome/free-solid-svg-icons";
import { Dispatch, SetStateAction } from "react";
import Logo from "../assets/img/Logo.png";
import { useEffect, useRef } from "react";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  userEmail: string;
  dropdownOpen: boolean;
  setDropdownOpen: Dispatch<SetStateAction<boolean>>;
  handleLogout: () => void;
}

export default function Header({
  sidebarOpen,
  setSidebarOpen,
  userEmail,
  dropdownOpen,
  setDropdownOpen,
  handleLogout,
}: HeaderProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setDropdownOpen]);

  return (
    <header
      className={`flex items-center justify-between bg-white px-4 py-2 fixed top-0 right-0 z-30 h-14
  ${sidebarOpen ? "md:left-64" : "md:left-16"} left-0`}
    >
      <div className="flex items-center gap-4">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <FontAwesomeIcon icon={faBars} size="lg" />
        </button>
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2 md:hidden">
        <img src={Logo} alt="Logo" className="h-6" />
      </div>

      <div className="relative hidden md:block" ref={dropdownRef}>
        <div
          className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <FontAwesomeIcon icon={faUserCircle} size="lg" />
          {userEmail && (
            <span className="text-sm font-medium hidden sm:inline">
              {userEmail}
            </span>
          )}
          <FontAwesomeIcon icon={faCaretDown} className="text-gray-500" />
        </div>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white shadow-md rounded-md py-2 z-50">
            <div
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
              onClick={handleLogout}
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" /> Logout
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
