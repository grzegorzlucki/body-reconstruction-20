import type { Profile } from "../db";
import type { PainLog, ProfileSettings, Session, WorkoutTemplate } from "../domain";

type ProfileQuery<T> = {
  where(field: "profileId"): {
    equals(profileId: string): {
      toArray(): Promise<T[]>;
    };
  };
};

type SortedProfileQuery<T> = {
  where(field: "profileId"): {
    equals(profileId: string): {
      sortBy(field: string): Promise<T[]>;
    };
  };
};

export type AppRepository = {
  profiles: {
    toArray(): Promise<Profile[]>;
    update(id: string, changes: ProfileSettings): Promise<unknown>;
  };
  templates: Pick<ProfileQuery<WorkoutTemplate>, "where"> & {
    put(template: WorkoutTemplate): Promise<unknown>;
    delete(id: string): Promise<unknown>;
  };
  logs: SortedProfileQuery<PainLog> & {
    put(log: PainLog): Promise<unknown>;
    delete(id: string): Promise<unknown>;
  };
  sessions: SortedProfileQuery<Session> & {
    put(session: Session): Promise<unknown>;
    add(session: Session): Promise<unknown>;
    delete(id: string): Promise<unknown>;
  };
};
