import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import { useEffect, useState } from 'react';

import { useTheme } from '@/theme';
import getAssetsContext from '@/theme/assets/getAssetsContext';

type Props = SvgProps & {
  path: string;
};

const icons = getAssetsContext('icons');
const EXTENSION = 'svg';

function IconByVariant({
  path,
  width = 24,
  height = 24,
  ...props
}: Props) {
  const [IconComponent, setIconComponent] = useState<FC<SvgProps> | null>(
    null,
  );
  const { variant } = useTheme();

  useEffect(() => {
    const loadIcon = () => {
      const module = icons(
        `./${path}.${EXTENSION}`,
      ) as { default: FC<SvgProps> };
      const defaultIcon = module.default;

      if (variant === 'default') {
        setIconComponent(() => defaultIcon);
        return;
      }

      try {
        const variantModule = icons(
          `./${variant}/${path}.${EXTENSION}`,
        ) as { default: FC<SvgProps> };
        setIconComponent(() => variantModule.default);
      } catch {
        setIconComponent(() => defaultIcon);
      }
    };

    loadIcon();
  }, [variant, path]);

  if (!IconComponent) {
    return null;
  }

  return <IconComponent height={height} width={width} {...props} />;
}

export default IconByVariant;
