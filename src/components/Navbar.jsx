import { useState } from 'react';
import { navigationItems, shopInfo } from '../mockData.js';

export function Navbar({ route, navigate }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (href) => {
    navigate(href);
    setIsOpen(false);
  };

  return (
    <header className="navbar">
      <button className="brandButton" type="button" onClick={() => handleNavigate('/home')}>
        <span className="brandMark">暮</span>
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
        {navigationItems.map((item) => (
          <button
            className={route === item.href ? 'navLink active' : 'navLink'}
            type="button"
            key={item.href}
            onClick={() => handleNavigate(item.href)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
