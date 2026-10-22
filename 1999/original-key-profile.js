import {mergeOriginalKeyStats,originalSavedKeyMean,originalLineKeyStats} from './original-key-stats.js';
export const ORIGINAL_KEY_PROFILE_STORAGE='retro-native-key-profile-v1';
/** Native current arrays persist for a launch; historical means update only
 * across launches, not each exercise. Browser saves are crash-safe snapshots. */
export function openOriginalKeyProfile(storage,sessionId){
 let previous={};try{const saved=JSON.parse(storage.getItem(ORIGINAL_KEY_PROFILE_STORAGE)||'null');if(saved){previous=saved.previous||{};if(saved.sessionId===sessionId)return saved;for(const [key,current]of Object.entries(saved.current||{}))previous[key]=originalSavedKeyMean(previous[key],current);}}catch{}
 return {sessionId,previous,current:{}};
}
export function appendOriginalKeyProfile(profile,stats,storage,glyphRecords=null){
 if(glyphRecords)originalLineKeyStats(glyphRecords,profile.current);else mergeOriginalKeyStats(profile.current,stats);try{storage.setItem(ORIGINAL_KEY_PROFILE_STORAGE,JSON.stringify(profile));}catch{}return profile;
}

export function closeOriginalKeyProfile(profile,storage){
 for(const [key,current]of Object.entries(profile.current||{}))profile.previous[key]=originalSavedKeyMean(profile.previous[key],current);
 profile.current={};try{storage.setItem(ORIGINAL_KEY_PROFILE_STORAGE,JSON.stringify(profile));}catch{}return profile;
}
