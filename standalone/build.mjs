import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
await build({configFile:false,root:fileURLToPath(new URL('./',import.meta.url)),plugins:[react()],build:{outDir:'public',emptyOutDir:true},publicDir:false});
await copyFile(new URL('../public/favicon.svg',import.meta.url),new URL('./public/favicon.svg',import.meta.url));
