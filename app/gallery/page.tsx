import GalleryArchive from "../GalleryArchive";
import SiteChrome from "../SiteChrome";
import { getGalleryAlbum, getGalleryAlbums, getSiteHome } from "@/features/site/server/data";

export default function GalleryPage(){
  const home=getSiteHome();
  const albums=getGalleryAlbums().map((album)=>getGalleryAlbum(album.id)).filter((album)=>album!==null);
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><GalleryArchive albums={albums}/></SiteChrome>;
}
