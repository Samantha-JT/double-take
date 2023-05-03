const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const actions = require('./actions');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { AISERVER } = DETECTORS || {};

module.exports.recognize = async ({ key }) => {
  const { URL } = AISERVER;
  const formData = new FormData();
  formData.append('image', fs.createReadStream(key));

  return axios({
    method: 'post',
    timeout: AISERVER.TIMEOUT * 1000,
    headers: {
      ...formData.getHeaders(),
    },
    url: `${URL}/v1/vision/face/recognize`,
    validateStatus() {
      return true;
    },
    data: formData,
  });
};

module.exports.train = ({ name, key }) => {
  const { URL } = AISERVER;
  const formData = new FormData();
  formData.append('image', fs.createReadStream(key));
  formData.append('userid', name);

  return axios({
    method: 'post',
    timeout: AISERVER.TIMEOUT * 1000,
    headers: {
      ...formData.getHeaders(),
    },
    url: `${URL}/v1/vision/face/register`,
    data: formData,
  });
};

module.exports.remove = ({ name }) => {
  const { URL } = AISERVER;
  const formData = new FormData();
  formData.append('userid', name);

  return axios({
    method: 'post',
    timeout: AISERVER.TIMEOUT * 1000,
    url: `${URL}/v1/vision/face/delete`,
    headers: {
      ...formData.getHeaders(),
    },
    validateStatus() {
      return true;
    },
    data: formData,
  });
};

module.exports.normalize = ({ camera, data }) => {
  if (!data.success) {
    console.warn('unexpected ai.server data');
    return [];
  }
  const { MATCH, UNKNOWN } = config.detect(camera);
  if (!data.predictions) {
    console.warn('unexpected ai.server predictions data');
    return [];
  }
  const normalized = data.predictions.flatMap((obj) => {
    const confidence = parseFloat((obj.confidence * 100).toFixed(2));
    const output = {
      name: confidence >= UNKNOWN.CONFIDENCE ? obj.userid.toLowerCase() : 'unknown',
      confidence,
      match:
        obj.userid !== 'unknown' &&
        confidence >= MATCH.CONFIDENCE &&
        (obj.x_max - obj.x_min) * (obj.y_max - obj.y_min) >= MATCH.MIN_AREA,
      box: {
        top: obj.y_min,
        left: obj.x_min,
        width: obj.x_max - obj.x_min,
        height: obj.y_max - obj.y_min,
      },
    };
    const checks = actions.checks({ MATCH, UNKNOWN, ...output });
    if (checks.length) output.checks = checks;
    return checks !== false ? output : [];
  });
  return normalized;
};
