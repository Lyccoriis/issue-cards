import type { UpdateState, UploadJob } from '@/types';

export {};

declare global {
  interface Window {
    api: {
      shell: {
        setTitle: (title: string) => void;
        setTheme: (theme: string) => void;
        openExternal: (url: string) => void;
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximized: (fn: (value: boolean) => void) => () => void;
      };
      upload: {
        pick: () => Promise<string[]>;
        file: (filePath: string, target: string) => Promise<UploadJob>;
        bytes: (data: ArrayBuffer, name: string, target: string) => Promise<UploadJob>;
        rehost: (url: string, target: string) => Promise<UploadJob>;
        jobs: () => Promise<UploadJob[]>;
        retry: (id: string) => Promise<UploadJob | null>;
        cancel: (id: string) => void;
        forget: (id: string) => void;
        onJob: (fn: (job: UploadJob) => void) => () => void;
        setImgurKey: (value: string) => void;
        pathForFile: (file: File) => string;
      };
      files: {
        pickFeature: () => Promise<{ name: string; text: string } | null>;
      };
      notify: {
        show: (payload: { id: string; title: string; body: string }) => void;
        onOpen: (fn: (id: string) => void) => () => void;
      };
      update: {
        state: () => Promise<UpdateState>;
        check: () => Promise<UpdateState>;
        download: () => Promise<UpdateState>;
        install: () => void;
        onState: (fn: (state: UpdateState) => void) => () => void;
      };
    };
  }
}
