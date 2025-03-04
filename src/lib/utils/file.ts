import fs from "fs";



export const getJsonFromFile = <T>(filename: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data) as T);
      }
    });
  });
};


export const isPathFolder = (path: string): boolean => fs.lstatSync(path).isDirectory();

export const isPathFile = (path: string): boolean => fs.lstatSync(path).isFile();