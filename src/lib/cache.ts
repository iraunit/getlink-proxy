import { createClient } from '@supabase/supabase-js';
import { APIOutput } from '../types';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

interface CacheRecord extends APIOutput {
  url: string;
  createdAt: Date;
}

const checkForCache = async (url: string): Promise<APIOutput | null> => {
  try {
    let { data, error } = await supabase
      .from('meta-cache')
      .select('*')
      .eq('url', url);

    if (error) {
      console.log(error);
      return null;
    }

    if (data) {
      const cacheEntry = data[0] as CacheRecord;
      if (!cacheEntry || !cacheEntry.createdAt) {
        return null;
      }
      const createdAt = new Date(cacheEntry.createdAt);
      const now = new Date();

      const diffTime = now.getTime() - createdAt.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays > 10) {
        const { error: deleteError } = await supabase
          .from('meta-cache')
          .delete()
          .eq('url', url);

        if (deleteError) {
          console.log(deleteError);
        }

        return null;
      } else {
        return cacheEntry as APIOutput;
      }
    }
    console.log(data);

    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const createCache = async (data: CacheRecord): Promise<boolean> => {
  try {
    await supabase.from('meta-cache').insert(data);

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export { checkForCache, createCache };
