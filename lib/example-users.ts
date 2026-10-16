import authors from '../app/example-authors.json';
export const exampleAuthors=authors;
export const exampleUserArgs=[JSON.stringify(authors)];
export const directoryCte=`WITH examples AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.username') AS username,json_extract(value,'$.occupation') AS occupation,json_extract(value,'$.position') AS position,json_extract(value,'$.company') AS company,json_extract(value,'$.bio') AS bio,json_extract(value,'$.created_at') AS updated_at,1 AS isExample FROM json_each(?)),directory AS (SELECT id,username,occupation,position,company,bio,updated_at,0 AS isExample FROM users UNION ALL SELECT * FROM examples)`;
