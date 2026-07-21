import { useEffect, useRef, useState } from 'react';

export function ImageWithLoading({
  src,
  alt = '',
  className = '',
  loading = 'lazy',
  ...imageProps
}) {
  const imageRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setLoaded(false);
    setFailed(!src);

    if (!src) return;

    // During SPA navigation the browser may serve a cached image before
    // React has a chance to receive its onLoad event. Check the actual image
    // state so cached images do not remain behind the loading animation.
    const image = imageRef.current;
    if (image?.complete) {
      const isLoaded = image.naturalWidth > 0;
      setLoaded(isLoaded);
      setFailed(!isLoaded);
    }
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
    setFailed(false);
  };

  const handleError = () => {
    setLoaded(false);
    setFailed(true);
  };

  const frameClassName = [
    'imageFrame',
    className,
    loaded ? 'isLoaded' : '',
    failed ? 'isError' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className={frameClassName} aria-busy={!loaded && !failed}>
      {!failed ? (
        <img
          {...imageProps}
          ref={imageRef}
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : (
        <span className="imageFallback" aria-hidden="true" />
      )}
    </span>
  );
}
