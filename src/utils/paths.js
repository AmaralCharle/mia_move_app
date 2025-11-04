export const getUserCollectionPath = (uid, collectionName, appId = (typeof __app_id !== 'undefined' ? __app_id : 'mia-move-app')) => {
  return `/artifacts/${appId}/users/${uid}/${collectionName}`
}
