import React from 'react';

const SectionHeader = ({ title, subtitle, align = 'center' }) => {
  return (
    <div className={`mb-16 reveal ${align === 'center' ? 'text-center mx-auto' : 'text-left'} max-w-3xl`}>
      <h2 className="font-serif text-4xl md:text-5xl text-slate-stone mb-6">
        {title}
      </h2>
      {subtitle && (
        <p className="font-sans text-stone-gray text-lg font-light">
          {subtitle}
        </p>
      )}
      <div className={`h-[1px] w-12 bg-slate-stone/30 mt-8 ${align === 'center' ? 'mx-auto' : ''}`}></div>
    </div>
  );
};

export default SectionHeader;
