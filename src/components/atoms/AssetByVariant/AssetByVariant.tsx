import type { ImageProps, ImageSourcePropType } from 'react-native';

import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { useTheme } from '@/theme';
import getAssetsContext from '@/theme/assets/getAssetsContext';

type Props = Omit<ImageProps, 'source'> & {
  extension?: string;
  path: string;
};

const images = getAssetsContext('images');

function AssetByVariant({ path, extension = 'png', ...props }: Props) {
  const [image, setImage] = useState<ImageSourcePropType>();
  const { variant } = useTheme();

  useEffect(() => {
    const loadImage = () => {
      const defaultSource = images(
        `./${path}.${extension}`,
      ) as ImageSourcePropType;

      if (variant === 'default') {
        setImage(defaultSource);
        return;
      }

      try {
        const variantSource = images(
          `./${variant}/${path}.${extension}`,
        ) as ImageSourcePropType;
        setImage(variantSource);
      } catch {
        setImage(defaultSource);
      }
    };

    loadImage();
  }, [variant, extension, path]);

  if (!image) {
    return null;
  }

  return <Image source={image} testID="variant-image" {...props} />;
}

export default AssetByVariant;
