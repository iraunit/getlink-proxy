import { MetaResult } from '../types';
import { AxiosRequestConfig } from 'axios';
import { customparserMetaResult } from './customParser';

const config: AxiosRequestConfig = {
  headers: {
    'Accept-Encoding': 'gzip,deflate,br'
  }
};

export const getMetadata = async (url: string): Promise<MetaResult | null> => {
  try {
    return (await customparserMetaResult(url, config)) as MetaResult;
  } catch (err) {
    return null;
  }
};

