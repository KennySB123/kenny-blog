import { REPO } from '../consts';

export const OWNER = REPO.owner;
export const NAME = REPO.name;
export const BRANCH = REPO.branch;

export const PATHS = {
  posts: 'src/content/blog',
  images: 'public/images',
  settings: 'src/data/distribution.json',
  ledger: 'src/data/syndication.json',
  jobs: 'pipeline/jobs',
};

export const WORKFLOWS = {
  distribute: 'distribute.yml',
  render: 'video-render.yml',
};
