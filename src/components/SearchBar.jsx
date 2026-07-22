import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

export default function SearchBar({ variant = 'compact', placeholder = 'Искать по своду знаний…' }) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  function onSubmit(e) {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
  }

  if (variant === 'compact') {
    return (
      <form className="searchbar searchbar--compact" onSubmit={onSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Поиск по своду знаний"
        />
      </form>
    );
  }

  return (
    <form className="searchbar searchbar--large" onSubmit={onSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Поиск по своду знаний"
      />
      <button type="submit">Искать</button>
    </form>
  );
}
