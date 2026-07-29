import type { SchemaTypeDefinition } from "sanity";
import { authorType } from "./author";
import { categoryType } from "./category";
import { destinationType } from "./destination";
import { calloutType } from "./objects/callout";
import { galleryType } from "./objects/gallery";
import { seoType } from "./objects/seo";
import { youtubeType } from "./objects/youtube";
import { postType } from "./post";
import { tagType } from "./tag";

export const schemaTypes: SchemaTypeDefinition[] = [
  postType,
  authorType,
  categoryType,
  tagType,
  destinationType,
  seoType,
  galleryType,
  youtubeType,
  calloutType,
];
