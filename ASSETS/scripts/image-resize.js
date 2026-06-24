/**
 * image-resize.js
 * Resizes image files before upload to save storage.
 *
 * Usage:
 *   const resized = await resizeImage(file, { maxSize: 400, quality: 0.8 });
 *   // resized is a Blob (JPEG) ready for upload
 */
(function () {
  function resizeImage(file, opts) {
    opts = opts || {};
    var maxSize = opts.maxSize || 400;
    var quality = opts.quality || 0.8;

    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;

          if (w <= maxSize && h <= maxSize) {
            resolve(file);
            return;
          }

          if (w > h) {
            h = Math.round(h * (maxSize / w));
            w = maxSize;
          } else {
            w = Math.round(w * (maxSize / h));
            h = maxSize;
          }

          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(function (blob) {
            if (blob) {
              blob.name = file.name.replace(/\.[^.]+$/, '.jpg');
              resolve(blob);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { resolve(file); };
        img.src = reader.result;
      };
      reader.onerror = function () { resolve(file); };
      reader.readAsDataURL(file);
    });
  }

  window.resizeImage = resizeImage;
})();
