import { commit } from './github';
import { PATHS } from './config';
import { localImages } from './preview';

const MAX_BYTES = 8 * 1024 * 1024;

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Commit an image to public/images and return its public path. */
export async function uploadImage(file: File, prefix: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only images can be uploaded.');
  if (file.size > MAX_BYTES) throw new Error('Images must be under 8 MB.');
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? file.type.split('/')[1] ?? 'png').toLowerCase().replace('jpeg', 'jpg');
  const base = (file.name.replace(/\.[^.]+$/, '') || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const name = `${prefix ? prefix + '-' : ''}${base || 'image'}-${Date.now().toString(36)}.${ext}`;
  await commit([{ path: `${PATHS.images}/${name}`, base64: await toBase64(file) }], `Add image ${name}`);
  const publicPath = `/images/${name}`;
  localImages.set(publicPath, URL.createObjectURL(file));
  return publicPath;
}
