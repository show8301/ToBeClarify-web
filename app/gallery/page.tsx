import GalleryArchive from "../GalleryArchive";
import SiteChrome from "../SiteChrome";
import { getGalleryAlbum, getGalleryAlbums, getSiteHome } from "../site-data";

export default function GalleryPage(){
  const home=getSiteHome();
  const albums=getGalleryAlbums().map((album)=>getGalleryAlbum(album.id)).filter((album)=>album!==null);
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo}><GalleryArchive albums={albums}/></SiteChrome>;
}
