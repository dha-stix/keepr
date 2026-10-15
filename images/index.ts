// All hotel photography lives in this folder. Import from here so every page uses the same files.
import standard1 from "./standard-1.jpg";
import standard2 from "./standard-2.jpg";
import standard3 from "./standard-3.jpg";
import standardBath from "./standard-bath.jpg";
import exclusive1 from "./exclusive-1.jpg";
import exclusive2 from "./exclusive-2.jpg";
import exclusive3 from "./exclusive-3.jpg";
import exclusive4 from "./exclusive-4.jpg";
import presidential1 from "./presidential-1.jpg";
import presidential2 from "./presidential-2.jpg";
import presidential3 from "./presidential-3.jpg";
import presidential4 from "./presidential-4.jpg";
import heroNight from "./hero-night.jpg";
import pool from "./pool.jpg";
import restaurant from "./restaurant.jpg";
import spa from "./spa.jpg";
import exterior from "./exterior.jpg";
import seaView from "./sea-view.jpg";

export const images = {
  standard1,
  standard2,
  standard3,
  standardBath,
  exclusive1,
  exclusive2,
  exclusive3,
  exclusive4,
  presidential1,
  presidential2,
  presidential3,
  presidential4,
  heroNight,
  pool,
  restaurant,
  spa,
  exterior,
  seaView,
};

export type ImageKey = keyof typeof images;

/** File name of each photo in this folder, for code that reads the files directly (link preview images) */
export const imageFiles: Record<ImageKey, string> = {
  standard1: "standard-1.jpg",
  standard2: "standard-2.jpg",
  standard3: "standard-3.jpg",
  standardBath: "standard-bath.jpg",
  exclusive1: "exclusive-1.jpg",
  exclusive2: "exclusive-2.jpg",
  exclusive3: "exclusive-3.jpg",
  exclusive4: "exclusive-4.jpg",
  presidential1: "presidential-1.jpg",
  presidential2: "presidential-2.jpg",
  presidential3: "presidential-3.jpg",
  presidential4: "presidential-4.jpg",
  heroNight: "hero-night.jpg",
  pool: "pool.jpg",
  restaurant: "restaurant.jpg",
  spa: "spa.jpg",
  exterior: "exterior.jpg",
  seaView: "sea-view.jpg",
};
