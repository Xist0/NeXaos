const requestQueue = [];
let processing = false;

const processQueue = () => {
  if (processing || !requestQueue.length) {
    return;
  }

  processing = true;
  const task = requestQueue.shift();

  task
    .executor()
    .then((result) => {
      task.resolve(result);
    })
    .catch((error) => {
      if (task.attempts < task.retries) {
        task.attempts += 1;
        requestQueue.unshift(task);
      } else {
        task.reject(error);
      }
    })
    .finally(() => {
      processing = false;
      processQueue();
    });
};

export const enqueueRequest = (executor, options = {}) => {
  const retries = options.retries ?? 1;

  return new Promise((resolve, reject) => {
    requestQueue.push({
      executor,
      resolve,
      reject,
      retries,
      attempts: 0,
    });
    processQueue();
  });
};




