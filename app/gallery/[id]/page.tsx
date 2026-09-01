import type { Metadata } from "next";
import GalleryArchive from "@/features/gallery/components/GalleryArchive";
import SiteChrome from "@/components/layout/SiteChrome";
import { getGalleryAlbum, getGalleryAlbums, getSiteHome } from "@/features/site/server/data";

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;
  const album=getGalleryAlbum(id);
  if(!album)return{title:"找不到活動紀錄｜清醒夢 Lucid Dream"};
  return{title:`${album.albumTitle}｜清醒夢活動紀錄`,description:album.albumDescription,openGraph:{images:album.coverImageUrl?[album.coverImageUrl]:[]}};
}

export default async function GalleryModalPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const home=getSiteHome();
  const albums=getGalleryAlbums().map((album)=>getGalleryAlbum(album.id)).filter((album)=>album!==null);
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><GalleryArchive albums={albums} initialAlbumId={id}/></SiteChrome>;
}
