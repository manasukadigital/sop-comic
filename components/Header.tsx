
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center space-x-4">
          <svg className="h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">SOP Comic Strip Generator</h1>
            <p className="text-sm text-gray-500">Turn boring procedures into engaging comics with AI.</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
