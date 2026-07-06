import { DEFAULT_BRAND } from '../../lib/brand';

interface BrandLogoProps {
  /** Logo image source. Defaults to the DEFAULT_BRAND logo. */
  src?: string;
  /** Accessible alt text. Defaults to the DEFAULT_BRAND company name. */
  alt?: string;
  /**
   * Size/layout classes. The logo is a large square-ish PNG, so constrain
   * height and let width follow (e.g. "h-10 w-auto").
   */
  className?: string;
}

/** Org-brand logo image. Height-constrained; width auto. */
export function BrandLogo({
  src = DEFAULT_BRAND.logoUrl,
  alt = DEFAULT_BRAND.companyName,
  className = 'h-10 w-auto',
}: BrandLogoProps) {
  return <img src={src} alt={alt} className={`shrink-0 object-contain ${className}`} />;
}
