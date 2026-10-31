import { useApp } from '@/appContext';
import { DataScreen } from '@/modules/data';
import { pickTextFile, shareTextFile } from '@/platform/files';

const files = { share: shareTextFile, pick: pickTextFile };

export default function Data() {
  const { app } = useApp();
  return <DataScreen data={app.data} files={files} />;
}
