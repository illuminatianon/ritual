export interface Song {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Version {
  id: number;
  song_id: number;
  version_number: number;
  lyrics: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Api {
  songs: {
    list(args?: { archived?: boolean }): Promise<Song[]>;
    create(name: string): Promise<Song>;
    rename(id: number, name: string): Promise<Song>;
    archive(id: number): Promise<void>;
    restore(id: number): Promise<Song>;
    deletePermanent(id: number): Promise<void>;
  };
  versions: {
    list(songId: number): Promise<Version[]>;
    save(args: { songId: number; lyrics: string; label?: string }): Promise<Version>;
    overwrite(args: { versionId: number; lyrics: string }): Promise<Version>;
    load(versionId: number): Promise<Version>;
    delete(versionId: number): Promise<void>;
  };
}
