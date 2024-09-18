import { MetaResult } from '../types';
import parser from 'html-metadata-parser';
import { AxiosRequestConfig } from 'axios';

const config: AxiosRequestConfig = {
  headers: {
    'Accept-Encoding': 'gzip,deflate,br'
  }
};

export const getMetadata = async (url: string): Promise<MetaResult | null> => {
  try {
    return (await parser(url, config)) as MetaResult;
  } catch (err) {
    console.log(err);
    return null;
  }
};

