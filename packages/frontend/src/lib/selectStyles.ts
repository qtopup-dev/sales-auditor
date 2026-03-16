import type { CSSObjectWithLabel, StylesConfig, GroupBase } from 'react-select';

interface SelectStyleOpts {
  height?: number;       // fixed control height in px (e.g. 40 for filter bar)
  error?: boolean;       // red border for validation errors
  nowrapValue?: boolean; // ellipsize placeholder/single value (sales sheet cells)
  focusRing?: boolean;   // blue border + ring (active editable cell)
}

const ellipsis: CSSObjectWithLabel = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// Single source of react-select styling. Colors read CSS variables set on
// :root / .dark in index.css so selects follow the active theme without re-render.
export function makeSelectStyles<Option, IsMulti extends boolean = false>(
  opts: SelectStyleOpts = {},
): StylesConfig<Option, IsMulti, GroupBase<Option>> {
  const { height, error, nowrapValue, focusRing } = opts;
  const borderColor = error ? '#ef4444' : focusRing ? '#3b82f6' : 'var(--select-border)';
  return {
    control: (base) => ({
      ...base,
      ...(height ? { height: `${height}px`, minHeight: `${height}px` } : { minHeight: '36px' }),
      fontSize: '14px',
      borderRadius: '6px',
      backgroundColor: 'var(--select-bg)',
      borderColor,
      ...(focusRing ? { boxShadow: '0 0 0 1px #3b82f6' } : {}),
      '&:hover': {
        borderColor: error || focusRing ? borderColor : 'var(--select-border-hover)',
      },
    }),
    valueContainer: (base) => ({ ...base, flexWrap: 'nowrap' }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--select-text)',
      ...(nowrapValue ? ellipsis : {}),
    }),
    input: (base) => ({ ...base, color: 'var(--select-text)' }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--select-placeholder)',
      ...(nowrapValue ? ellipsis : {}),
    }),
    menu: (base) => ({ ...base, zIndex: 9999, backgroundColor: 'var(--select-menu-bg)' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--select-option-selected)'
        : state.isFocused
          ? 'var(--select-option-focus)'
          : 'var(--select-menu-bg)',
      color: state.isSelected ? '#ffffff' : 'var(--select-text)',
    }),
  };
}
