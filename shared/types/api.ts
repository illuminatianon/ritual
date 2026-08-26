export interface Song {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  next_version_number: number;
  latest_version_number?: number | null;
  latest_version_updated_at?: string | null;
}

export interface Version {
  id: string;
  song_id: string;
  version_number: number;
  lyrics: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface StyleVersion {
  id: string;
  style_id: string;
  version_number: number;
  positive_prompt: string;
  negative_prompt: string;
  metadata_json: string;
  created_at: string;
}

export interface Style {
  id: string;
  name: string;
  current_version_id: string;
  next_version_number: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  current_version: StyleVersion;
}

export interface StyleDetail extends Style {
  versions: StyleVersion[];
}

export interface Api {
  songs: {
    list(args?: { archived?: boolean }): Promise<Song[]>;
    create(name: string): Promise<Song>;
    rename(id: string, name: string): Promise<Song>;
    archive(id: string): Promise<void>;
    restore(id: string): Promise<Song>;
    deletePermanent(id: string): Promise<void>;
  };
  versions: {
    list(songId: string): Promise<Version[]>;
    save(args: { songId: string; lyrics: string; label?: string }): Promise<Version>;
    overwrite(args: { versionId: string; lyrics: string }): Promise<Version>;
    load(versionId: string): Promise<Version>;
    delete(versionId: string): Promise<void>;
  };
  styles: {
    list(): Promise<Style[]>;
    create(args: { name: string; positive_prompt: string; negative_prompt?: string; metadata?: Record<string, unknown> }): Promise<StyleDetail>;
    get(styleId: string): Promise<StyleDetail>;
    appendVersion(args: { styleId: string; name: string; positive_prompt: string; negative_prompt?: string; metadata?: Record<string, unknown> }): Promise<StyleDetail>;
    delete(styleId: string): Promise<void>;
  };
  styleModel: {
    generate(request: string): Promise<{ positive_prompt: string; negative_prompt: string }>;
    refine(args: { positive_prompt: string; negative_prompt?: string; instruction: string }): Promise<{ positive_prompt: string; negative_prompt: string }>;
  };
}
