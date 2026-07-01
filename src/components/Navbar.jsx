import { useEffect, useRef, useState } from 'react';
import brandMark from '../assets/brand-mark.svg';
import { navigationItems, shopInfo } from '../mockData.js';

export function Navbar({ route, navigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const closeDropdownTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (closeDropdownTimer.current) {
        window.clearTimeout(closeDropdownTimer.current);
      }
    };
  }, []);

  const openDropdownMenu = (label) => {
    if (closeDropdownTimer.current) {
      window.clearTimeout(closeDropdownTimer.current);
    }
    setOpenDropdown(label);
  };

  const closeDropdownMenu = () => {
    if (closeDropdownTimer.current) {
      window.clearTimeout(closeDropdownTimer.current);
    }
    closeDropdownTimer.current = window.setTimeout(() => {
      setOpenDropdown(null);
    }, 220);
  };

  const closeDropdownNow = () => {
    if (closeDropdownTimer.current) {
      window.clearTimeout(closeDropdownTimer.current);
    }
    setOpenDropdown(null);
  };

  const handleNavigate = (href) => {
    navigate(href);
    setIsOpen(false);
    closeDropdownNow();
  };

  return (
    <header className="navbar">
      <button className="brandButton" type="button" onClick={() => handleNavigate('/home')}>
        <span className="brandMark">
          <img src={brandMark} alt="" />
        </span>
        <span>
          <strong>{shopInfo.name}</strong>
          <small>{shopInfo.shortName}</small>
        </span>
      </button>

      <button
        className="menuButton"
        type="button"
        aria-label="切換導覽選單"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`navLinks ${isOpen ? 'isOpen' : ''}`} aria-label="主要導覽">
        {navigationItems.map((item) => {
          const isDropdownActive = item.children?.some((child) => child.href === route);

          if (item.children) {
            return (
              <div
                className={openDropdown === item.label ? 'navDropdown isOpen' : 'navDropdown'}
                key={item.href}
                onMouseEnter={() => openDropdownMenu(item.label)}
                onMouseLeave={closeDropdownMenu}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    closeDropdownNow();
                  }
                }}
              >
                <button
                  className={isDropdownActive ? 'navLink active' : 'navLink'}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === item.label}
                  onFocus={() => openDropdownMenu(item.label)}
                  onClick={(event) => event.preventDefault()}
                >
                  {item.label}
                </button>
                <div className="navDropdownMenu" role="menu">
                  {item.children.map((child) => (
                    <button
                      className={route === child.href ? 'navDropdownItem active' : 'navDropdownItem'}
                      type="button"
                      role="menuitem"
                      key={child.href}
                      onClick={() => handleNavigate(child.href)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <button
              className={route === item.href ? 'navLink active' : 'navLink'}
              type="button"
              key={item.href}
              onClick={() => handleNavigate(item.href)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
