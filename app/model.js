const db = require("../db/connection");

const checkArticleExists = (articleId) => {
  return db
  .query("SELECT * FROM articles WHERE article_id = $1", [articleId])
  .then(({rows}) => {
    if(rows.length === 0){
      return Promise.reject({status: 404, msg: "Article Not Found"});
    }else{
      return true;
    };
  });
};

const checkUserExists = (username) => {
  return db
  .query("SELECT * FROM users WHERE username = $1", [username])
  .then(({rows}) => {
    if(rows.length === 0){
      return Promise.reject({status: 404, msg: "User Does Not Exist"});
    }else{
      return true;
    };
  });
};

const checkCommentExists = (commentId) => {
  return db
  .query("SELECT * FROM comments WHERE comment_id = $1", [commentId])
  .then(({rows}) => {
    if(rows.length === 0){
      return Promise.reject({status: 404, msg: "Comment Not Found"});
    }else{
      return true;
    };
  });
};

const checkTopicExists = (topic) => {
  return db
  .query("SELECT * FROM topics WHERE slug = $1", [topic])
  .then(({rows}) => {
    if(rows.length === 0){
      return Promise.reject({status: 404, msg: "Topic Not Found"});
    }else{
      return true;
    };
  });
};

const checkArticleTitleExists = (title) => {
  return db
  .query("SELECT * FROM articles WHERE title = $1", [title])
  .then(({rows}) => {
    if(rows.length > 0){
      return Promise.reject({status: 400, msg: "Article With That Title Already Exists"});
    }else{
      return true;
    };
  });
}

exports.selectTopics = () => {
    return db
    .query("SELECT slug, description FROM topics")
    .then(({rows}) => {
      return rows;
    });
};

exports.selectArticlesById = (articleId) => {
    return db
    .query(`
      SELECT articles.*,
      COUNT(comments.comment_id) AS comment_count 
      FROM articles 
      LEFT JOIN comments 
      ON articles.article_id = comments.article_id
      WHERE articles.article_id = $1
      GROUP BY articles.article_id
      `, [articleId])
    .then(({rows}) => {
        if (rows.length === 0){
            return Promise.reject({status: 404, msg: "Article Not Found"});
        }else{
            return rows[0];
        };
    });
};

exports.selectArticles = (sortCriteria = "created_at", orderCriteria = "desc", topic, limit = 10, p = 1) => {

  const greenlistSortCriteria = ["article_id", "title", "topic", "author", "created_at", "votes", "article_img_url"];
  const greenlistOrderCriteria = ["desc", "asc"];

  if (!greenlistSortCriteria.includes(sortCriteria) || !greenlistOrderCriteria.includes(orderCriteria)){
    return Promise.reject({status: 400, msg: "Bad Request"});
  };

  const offset = (p - 1) * limit;

    let queryStr = `
      SELECT 
        articles.article_id, 
        articles.title, 
        articles.topic, 
        articles.author, 
        articles.created_at, 
        articles.votes, 
        articles.article_img_url,
        COUNT(comments.comment_id) AS comment_count 
      FROM articles 
      LEFT JOIN comments 
        ON articles.article_id = comments.article_id`;
   
   const queryValues = [];

   if (topic){
    return checkTopicExists(topic)
    .then(() => {
      queryStr += ` WHERE articles.topic = $1`;
      queryValues.push(topic);

      queryStr += `  GROUP BY articles.article_id 
      ORDER BY ${sortCriteria} ${orderCriteria}
      LIMIT $2 OFFSET $3`;

      const countQuery = `SELECT COUNT (*)::INT AS total_count
      FROM articles WHERE articles.topic = $1`
      const countValues = [topic];

      queryValues.push(limit, offset)

      const articlesPromise = db.query(queryStr, queryValues);
      const countPromise = db.query(countQuery, countValues);

      return Promise.all([articlesPromise, countPromise])
      .then(([{rows: articles}, {rows: [{ total_count}]}]) => {
        return { articles, total_count }
      });
    });
   }else{
    queryStr += `  GROUP BY articles.article_id 
      ORDER BY ${sortCriteria} ${orderCriteria}
      LIMIT $1 OFFSET $2`;

      const countQuery = `SELECT COUNT (*)::INT AS total_count
      FROM articles`;
      queryValues.push(limit, offset)

      const articlesPromise = db.query(queryStr, queryValues);
      const countPromise = db.query(countQuery);

      return Promise.all([articlesPromise, countPromise])
      .then(([{rows: articles}, {rows: [{ total_count}]}]) => {
        return { articles, total_count }
      });
   };
};

exports.selectCommentsByArticle = (articleId, limit = 10, p = 1) => {
  if (typeof limit !== "number"){
    limit = 10;
  };
  if (typeof p !== "number"){
    p = 1;
  };
  const offset = (p - 1) * limit;
  return checkArticleExists(articleId)
  .then(() => {
    return db
    .query(`SELECT * FROM comments WHERE article_id = $1 LIMIT $2 OFFSET $3`, [articleId, limit, offset])
    .then(({rows}) => {
      if (rows.length === 0){
        return Promise.reject({status: 404, msg: "No Comments Found"});
    }else{
        return rows;
    };
    });
  });
};

exports.insertCommentsByArticle = (articleId, author, body) => {
  if(typeof author !== "string"|| typeof body !== "string"){
    return Promise.reject({status: 400, msg: "Bad Request"});
  }
  return checkArticleExists(articleId)
  .then(() => {
    return checkUserExists(author)
    .then(() => {
      return db
      .query(
        `INSERT INTO comments (article_id, author, body) VALUES ($1, $2, $3) RETURNING author, body, created_at, votes, comment_id`, [articleId, author, body])
      .then(({rows}) => {
        return rows[0];
      });
    });
  });
};

exports.updateArticleVotes = (articleId, votesToUpdate) => {
  if (typeof votesToUpdate !== "number"){
    return Promise.reject({status: 400, msg: "Votes Must Be A Number"});
  }
  return checkArticleExists(articleId)
  .then(() => {
    return db.query(
      `UPDATE articles SET votes = votes + $1 WHERE article_id = $2 RETURNING *`, [votesToUpdate, articleId]);
  })
  .then(({rows}) => {
    return rows[0];
  });
};

exports.removeComment = (commentId) => {
  return checkCommentExists(commentId)
  .then(() => {
    return db
    .query(
      `DELETE FROM comments WHERE comment_id = $1`, [commentId]);
  }).then(({rows}) => {
    return rows;
  });
};

exports.selectComments = () => {
  return db
  .query(
    `SELECT * FROM comments`)
    .then(({ rows }) => {
      return rows;
    });
};

exports.selectUsers = () => {
  return db
  .query("SELECT username, name, avatar_url FROM users")
  .then(({ rows }) => {
    return rows;
  });
};

exports.selectUserByUsername = (username) => {
  return db
  .query(`SELECT * FROM users WHERE username = $1`, [username])
  .then(({rows}) => {
    if (rows.length === 0){
      return Promise.reject({status: 404, msg: "No User With That Username Found"});
  }else{
      return rows[0];
  };
  });
};

exports.updateCommentVotes = (commentId, votesToUpdate) => {
  if (typeof votesToUpdate !== "number"){
    return Promise.reject({status:400, msg: "Votes Must Be A Number"});
  }
  return checkCommentExists(commentId)
  .then(() => {
    return db.query(
      `UPDATE comments SET votes = votes + $1 WHERE comment_id = $2 RETURNING *`,
      [votesToUpdate, commentId]);
  })
  .then(({rows}) => {
    return rows[0];
  });
};

exports.insertArticle = (author, title, body, topic, article_img_url) => {
  const properties = [author, title, body, topic, article_img_url]
  const propertiesTypeCheck = properties.every(property => typeof property === "string");
  const propertiesPresentCheck = properties.every(property => !null);

  if (!propertiesTypeCheck || !propertiesPresentCheck){
    return Promise.reject({status: 400, msg: "Bad Request"});
  };
  return checkArticleTitleExists(title)
  .then(() => checkUserExists(author))
  .then(() => checkTopicExists(topic))
    .then(() => {
      return db
    .query(`INSERT INTO articles (author, title, body, topic, article_img_url) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [author, title, body, topic, article_img_url])
    .then(({rows}) => {
      const articleId = rows[0].article_id;
      return db
      .query(`SELECT 
        articles.article_id, 
        articles.title, 
        articles.topic,
        articles.body,
        articles.author, 
        articles.created_at, 
        articles.votes, 
        articles.article_img_url,
        COUNT(comments.comment_id) AS comment_count 
      FROM articles 
      LEFT JOIN comments 
        ON articles.article_id = comments.article_id 
        WHERE articles.article_id = $1 
        GROUP BY articles.article_id`, [articleId])
        .then(({rows}) => {
          return rows[0]
        });
    });
    });
  };

exports.insertTopic = (slug, description) => {
  const properties = [slug, description];
  const propertiesTypeCheck = properties.every(property => typeof property === "string");
  const propertiesPresentCheck = properties.every(property => !null);

  if (!propertiesTypeCheck || !propertiesPresentCheck){
    return Promise.reject({status: 400, msg: "Bad Request"});
  };

  return db
  .query(`INSERT INTO topics (slug, description) VALUES ($1, $2) RETURNING slug, description`, [slug, description])
  .then(({rows}) => {
    return rows[0];
  });
};

exports.removeArticle = (articleId) => {
  return checkArticleExists(articleId)
  .then(() => {
    return db
    .query
      (`DELETE FROM articles WHERE article_id = $1`, [articleId]);
  }).then(() => {
    return db
    .query 
      (`DELETE FROM comments WHERE article_id = $1`, [articleId])
  })
};
