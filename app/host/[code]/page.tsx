import { RoomClient } from "@/components/room";
export default async function Host({ params }: { params: Promise<{ code: string }> }) { const { code } = await params; return <RoomClient code={code.toUpperCase()} host />; }
