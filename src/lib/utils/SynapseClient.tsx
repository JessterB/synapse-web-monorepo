import { BatchFileResult } from './jsonResponses/BatchFileResult'
import { Entity } from './jsonResponses/Entity'
import { FileHandleResults } from './jsonResponses/FileHandleResults'
import { SynapseVersion } from './jsonResponses/SynapseVersion'
import { QueryResultBundle } from './jsonResponses/Table/QueryResultBundle'
import { WikiPage } from './jsonResponses/WikiPage'
import { QueryBundleRequest } from './jsonResponses/Table/QueryBundleRequest'
import { FaceFacetColumnValuesRequest } from './jsonResponses/Table/FacetColumnRequest'

// TODO: Create JSON response types for return types
const DEFAULT_ENDPOINT = 'https://repo-prod.prod.sagebase.org/'
const DEFAULT_SWC_ENDPOINT = 'https://www.synapse.org/'

function delay(t: any) {
  return new Promise((resolve) => {
    setTimeout(resolve.bind(null, null), t)
  })
}
function parseJSON(response: any) {
  return response.text()
  .then((text: string) => {
    let parsedJson = ''
    try {
      parsedJson = JSON.parse(text)
    } catch (err) {
      console.log('Caught exception with parsing json ', err)
      parsedJson = text
    }
    return parsedJson ? parsedJson : {}
  }).catch(
    // this should never happen!
    (err: string) => {
      console.log('Caught exception loading response text ', err)
      return {}
    }
  )
}
const fetchWithExponentialTimeout = (url: string, options: any, delayMs: any, retries: number): Promise<any> => {
  return fetch(url, options)
    .then((resp) => {
      if (resp.status > 199 && resp.status < 300) {
        // ok!
        return parseJSON(resp)
      }
      if (resp.status === 429 || resp.status === 0) {
        // TOO_MANY_REQUESTS_STATUS_CODE, or network connection is down.  Retry after a couple of seconds.
        if (retries === 1) {
          return Promise.reject({
            reason: resp.statusText,
            statusCode: resp.status
          })
        }
        return delay(delayMs).then(() => {
          return fetchWithExponentialTimeout(url, options, delayMs * 2, retries - 1)
        })
      }
      // error status that indicates no more retries
      return resp
        .json()
        .then((json) => {
          // on okay response return json, o.w. reject with json and
          // send to catch block
          const error = {
            reason: json.reason,
            status: resp.status
          }
          return resp.ok ? json : Promise.reject(error)
        })
        .catch((error) => {
          // call failed above
          if (error.reason && error.status) {
            // successfull return from server but invalid call
            // the call was recieved, but staus wasn't ok-- return the json response from above
            // from the response directly
            return Promise.reject({
              reason: error.reason,
              statusCode: error.status
            })
          }
          return Promise.reject({
            reason: resp.statusText,
            statusCode: resp.status
          })
        })
    })
    .catch((error) => {
      // this should never happen
      return Promise.reject(error)
    })
}

export const doPost = (
                        url: string,
                        requestJsonObject: any,
                        sessionToken: string | undefined,
                        initCredentials: string | undefined,
                        endpoint: string): Promise<any> => {
  const options: any = {
    body: JSON.stringify(requestJsonObject),
    headers: {
      Accept: '*/*',
      'Access-Control-Request-Headers': 'sessiontoken',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    mode: 'cors',
    credentials: initCredentials
  }
  if (initCredentials) {
    options.credentials = initCredentials
  }
  if (sessionToken) {
    options.headers.sessionToken = sessionToken
  }
  return fetchWithExponentialTimeout(endpoint + url, options, 1000, 5)
}
export const doGet = (
                      url: string,
                      sessionToken: string | undefined,
                      initCredentials: string | undefined,
                      endpoint: string) => {
  const options: any = {
    headers: {
      Accept: '*/*',
      'Access-Control-Request-Headers': 'sessiontoken'
    },
    method: 'GET',
    mode: 'cors'
  }
  if (initCredentials) {
    options.credentials = initCredentials
  }
  if (sessionToken) {
    options.headers.sessionToken = sessionToken
  }
  return fetchWithExponentialTimeout(endpoint + url, options, 1000, 5)
}

export const getVersion = (endpoint: string = DEFAULT_ENDPOINT): Promise<SynapseVersion> => {
  return doGet('/repo/v1/version', undefined, undefined, endpoint) as Promise<SynapseVersion>
}

export const getQueryTableResultsFromJobId = (
  entityId: string,
  jobId: string,
  sessionToken: string | undefined = undefined,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<QueryResultBundle> => {
  return doGet(`/repo/v1/entity/${entityId}/table/query/async/get/${jobId}`, sessionToken, undefined, endpoint)
    .then((resp: any) => {
      // is this the job status?
      if (resp.jobState && resp.jobState !== 'FAILED') {
        // still processing, wait for a second and try again
        return delay(500).then(() => {
          return getQueryTableResultsFromJobId(entityId, jobId, sessionToken, endpoint)
        })
      }
      // these must be the query results!
      return resp
    })
    .catch((error) => {
      throw error
    })
}
/**
 * This method is necesary because the backend service returns ALL table results when
 * a particular facet is empty, the rationale being that it is a slight optimization
 * for when a client first gets table results. However, it introduces an edge case on the front
 * end that when the user "deselects" all facets inside Facets.tsx, uninutitive to the user,
 * all results would be returned, so we have to make this a special case.
 *
 * Note: This is under the context that the user is exploring with only a single facet in mind,
 * beyond that this issue becomes much more confusing.
 *
 * @param {*} queryBundleRequest
 * @param {*} sessionToken
 * @param {*} lastQueryResult
 * @param {*} filter
 * @param {*} endpoint
 */
export const getIntuitiveQueryTableResults = (
  queryBundleRequest: QueryBundleRequest,
  sessionToken: string | undefined = undefined,
  filter: string,
  lastQueryResult: QueryResultBundle,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<QueryResultBundle> => {

  const facetSelection = queryBundleRequest.query.selectedFacets as FaceFacetColumnValuesRequest []

  const facetsForFilter = facetSelection.filter((obj: FaceFacetColumnValuesRequest) => {
    return obj.columnName === filter
  })[0] as FaceFacetColumnValuesRequest

  // check if the current set of facets being used is empty or not
  if (facetsForFilter.facetValues.length === 0) {
    // zero out the rows
    lastQueryResult.queryResult.queryResults.rows = []
    return Promise.resolve(lastQueryResult)
  }

  return getQueryTableResults(queryBundleRequest, sessionToken, endpoint)
}
/**
 * http://docs.synapse.org/rest/POST/entity/id/table/query/nextPage/async/start.html
 * @param {*} queryBundleRequest
 * @param {*} sessionToken
 * @param {*} endpoint
 */
export const getQueryTableResults = (
  queryBundleRequest: any,
  sessionToken: string | undefined = undefined,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<QueryResultBundle> => {
  return doPost(`/repo/v1/entity/${queryBundleRequest.entityId}/table/query/async/start`, queryBundleRequest, sessionToken, undefined, endpoint)
  .then((resp: any) => {
      // started query, now attempt to get the results.
    return getQueryTableResultsFromJobId(queryBundleRequest.entityId, resp.token, sessionToken, endpoint)
  })
  .catch((error) => {
    throw error
  })
}
/**
 *  Run and return results from queryBundleRequest, queryBundle request must be of the
 *  form:
 *     {
 *        concreteType: String,
 *        query: {
 *           sql: String,
 *           isConsistent: Boolean,
 *           partMask: Number
 *        }
 *     }
 * @param {*} queryBundleRequest
 * @param {*} [sessionToken=undefined]
 * @param {boolean} [onlyGetFacets=false] Specify if the query only needs facets and no
 * data-- (internally this limits the row count to 1 on the request)
 * @returns Full dataset from synapse table query
 */
export const getFullQueryTableResults = async (queryBundleRequest: any,
                                               sessionToken: string | undefined = undefined)
                                               : Promise<QueryResultBundle> => {
  // TODO: Find out why theres a bug causing the query limit
  const { query, ...rest } = queryBundleRequest
  let data: any = {}
  let maxPageSize: number = 150
  const queryRequest: any = {
    ...rest,
    query: { ...query, limit: maxPageSize }
  }
  // Have to make two "sets" of calls for query, the first one tells us the maximum size per page of data
  // we can get, the following uses that maximum and offsets to the appropriate location to get the data
  // afterwards, the process repeats
  await getQueryTableResults(queryRequest, sessionToken).then(
    async (initData: QueryResultBundle) => {
      let queryCount: any = initData.queryResult.queryResults.rows.length
      let currentQueryCount: number = queryCount
      data = initData
      // Get the subsequent data, note- although the function calls itself, it runs
      // iteratively due to the await
      const getData = async () => {
        if (queryCount === maxPageSize) {
          maxPageSize = initData.maxRowsPerPage!
          const queryRequestWithMaxPageSize = {
            ...rest,
            query: { ...query, limit: maxPageSize, offset: currentQueryCount }
          }
          await getQueryTableResults(queryRequestWithMaxPageSize, sessionToken)
            .then((postData: any) => {
              queryCount += postData.queryResult.queryResults.rows.length
              if (queryCount > 0) {
                currentQueryCount += queryCount
                data.queryResult.queryResults.rows.push(
                  ...postData.queryResult.queryResults.rows // ... spread operator to push all elements on
                )
              }
              return getData()
            })
            .catch((err) => {
              console.log('Error on getting table results ', err)
            })
        } else {
          // set data to this plots sql in the query data
          return data
        }
      }
      return getData()
    })
  return data
}

/**
 *  Log-in using the given username and password.  Will return a session token that must be used in
 *  authenticated requests.
 *  http://docs.synapse.org/rest/POST/login.html
 */
export const login = (username: string, password: string, endpoint = DEFAULT_ENDPOINT) => {
  return doPost('/auth/v1/login', { username, password }, undefined, undefined, endpoint)
}
/**
 * Get redirect url
 * https://docs.synapse.org/rest/POST/oauth2/authurl.html
 * @param {*} provider
 * @param {*} redirectUrl
 * @param {*} endpoint
 */
export let oAuthUrlRequest = (provider: string, redirectUrl: string, endpoint = DEFAULT_ENDPOINT) => {
  return doPost('/auth/v1/oauth2/authurl', { provider, redirectUrl }, undefined, undefined, endpoint)
}
/**
 * Get session token from SSO
 * https://docs.synapse.org/rest/POST/oauth2/session.html
 * @param {*} provider
 * @param {*} authenticationCode
 * @param {*} redirectUrl
 * @param {*} endpoint
 */
export let oAuthSessionRequest = (provider: string,
                                  authenticationCode: string | number,
                                  redirectUrl: string,
                                  endpoint: any = DEFAULT_ENDPOINT) => {
  return doPost(
    '/auth/v1/oauth2/session',
    { provider, authenticationCode, redirectUrl }, undefined, undefined, endpoint)
}
/**
 * Create an entity (Project, Folder, File, Table, View)
 * http://docs.synapse.org/rest/POST/entity.html
 */
export const createEntity = (entity: any, sessionToken: string | undefined, endpoint: string = DEFAULT_ENDPOINT) => {
  return doPost('/repo/v1/entity', entity, sessionToken, undefined, endpoint)
}
/**
 * Create a project with the given name.
 * http://docs.synapse.org/rest/POST/entity.html
 */
export const createProject = (name: string,
                              sessionToken: string | undefined,
                              endpoint: string = DEFAULT_ENDPOINT)
                              : Promise<Response> => {
  return createEntity(
    {
      name,
      concreteType: 'org.sagebionetworks.repo.model.Project'
    },
    sessionToken,
    endpoint
  )
}

/**
 * Return this user's UserProfile
 * http://docs.synapse.org/rest/GET/userProfile.html
 */
export const getUserProfile = (sessionToken: string | undefined, endpoint = DEFAULT_ENDPOINT) => {
  return doGet('/repo/v1/userProfile', sessionToken, undefined, endpoint)
}
/**
 * Return the User Profiles for the given list of user IDs
 * http://docs.synapse.org/rest/POST/userProfile.html
 */
export const getUserProfiles = (userIdsArray: number[] = [], endpoint: string = DEFAULT_ENDPOINT) => {
  return doPost('/repo/v1/userProfile', { list: userIdsArray }, undefined, undefined, endpoint)
}
/**
 * Return the children (Files/Folders) of the given entity (Project or Folder).
 * http://docs.synapse.org/rest/POST/entity/children.html
 */
export const getEntityChildren = (request: any,
                                  sessionToken: string | undefined = undefined,
                                  endpoint: string = DEFAULT_ENDPOINT) => {
  return doPost('/repo/v1/entity/children', request, sessionToken, undefined, endpoint)
}
/**
 * Get a batch of pre-signed URLs and/or FileHandles for the given list of FileHandleAssociations.
 * http://docs.synapse.org/rest/POST/fileHandle/batch.html
 */
export const getFiles = (request: any,
                         sessionToken: string | undefined = undefined,
                         endpoint: string = DEFAULT_ENDPOINT): Promise<BatchFileResult> => {
  return doPost('/file/v1/fileHandle/batch', request, sessionToken, undefined, endpoint)
}
/**
 * Bundled access to Entity and related data components.
 * An EntityBundle can be used to create, fetch, or update an Entity and associated
 * objects with a single web service request.
 * See SynapseClient.test.js for an example partsMask.
 * https://docs.synapse.org/rest/org/sagebionetworks/repo/model/Entity.html
 */
export const getEntity = (sessionToken: string | undefined = undefined,
                          entityId: string | number,
                          endpoint = DEFAULT_ENDPOINT): Promise<Entity> => {
  const url = `/repo/v1/entity/${entityId}`
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 * Bundled access to Entity and related data components.
 * An EntityBundle can be used to create, fetch, or update an Entity and
 * associated objects with a single web service request.
 * See SynapseClient.test.js for an example partsMask.
 * http://docs.synapse.org/rest/GET/entity/id/version/versionNumber/bundle.html
 */
export const getEntityBundleForVersion = (
  entityId: string | number,
  version: string | number | undefined,
  partsMask: string | number,
  sessionToken: string | undefined = undefined,
  endpoint = DEFAULT_ENDPOINT
) => {
  let url = `/repo/v1/entity/${entityId}`
  if (version) {
    url += `/version/ + ${version}`
  }
  url += `/bundle?mask= ${partsMask}`
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 * Get Wiki page contents, call is of the form:
 * http://docs.synapse.org/rest/GET/entity/ownerId/wiki.html
 */
export const getEntityWiki = (sessionToken: string | undefined,
                              ownerId: string | undefined,
                              wikiId: string | undefined,
                              endpoint: string = DEFAULT_ENDPOINT) => {
  const url = `/repo/v1/entity/${ownerId}/wiki/${wikiId}`
  return doGet(url, sessionToken, undefined, endpoint) as Promise<WikiPage>
}

/**
 * Returns synapse user favorites list given their session token
 * http://docs.synapse.org/rest/GET/favorite.html
 */
export const getUserFavorites = (sessionToken: string | undefined, endpoint = DEFAULT_ENDPOINT) => {
  const url = 'repo/v1/favorite?offset=0&limit=200'
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 *  http://docs.synapse.org/rest/GET/projects/type.html
 *  @param {String} projectDetails Can be "MY_PROJECTS", "MY_CREATED_PROJECTS" or "MY_PARTICIPATED_PROJECTS"
 */
export const getUserProjectList = (sessionToken: string | undefined,
                                   projectDetails: string,
                                   endpoint = DEFAULT_ENDPOINT) => {
  const url = `repo/v1/projects/${projectDetails}?offset=0&limit=200`
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 * Get the user's list of teams they are on
 *
 * @param {*} id ownerID of the synapse user see - http://docs.synapse.org/rest/org/sagebionetworks/repo/model/UserProfile.html
 */
export const getUserTeamList = (sessionToken: string | undefined, id: string | number, endpoint = DEFAULT_ENDPOINT) => {
  const url = `repo/v1/user/${id}/team?offset=0&limit=200`
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 * Get the user's list of teams they are on
 *
 * @param {*} id ownerID of the synapse user see -https://docs.synapse.org/rest/GET/teamMembers/id.html
 * @param {*} fragment (optional) a prefix of the user's first or last name or email address (optional)
 * @param {*} limit    (optional) the maximum number of members to return (default 10, max limit 50)
 * @param {*} offset   (optional) the starting index of the returned results (default 0)
 *
 */
export const getTeamList = (
  sessionToken: string | undefined,
  id: string | number,
  fragment: string = '',
  limit: number = 10,
  offset: number = 0,
  endpoint: string = DEFAULT_ENDPOINT
) => {
  const url = `repo/v1/teamMembers/${id}?limit=${limit}&offset=${offset}${fragment ? `&fragment=${fragment}` : ''}`
  return doGet(url, sessionToken, undefined, endpoint)
}

export const getWikiAttachmentsFromEntity =
    (
      sessionToken: string | undefined,
      id: string | number,
      wikiId: string | number,
      endpoint: string = DEFAULT_ENDPOINT): Promise<FileHandleResults> => {
      const url = `repo/v1/entity/${id}/wiki/${wikiId}/attachmenthandles`
      return doGet(url, sessionToken, undefined, endpoint)
    }
export const getWikiAttachmentsFromEvaluation = (sessionToken: string | undefined,
                                                 id: string | number,
                                                 wikiId: string | number,
                                                 endpoint: string = DEFAULT_ENDPOINT) => {
  const url = `repo/v1/evaluation/${id}/wiki/${wikiId}/attachmenthandles`
  return doGet(url, sessionToken, undefined, endpoint)
}
/**
 * Set the session token cookie.  Note that this will only succeed if your app is running on
 * a .synapse.org subdomain.
 *
 * @param {*} token Session token.  If undefined, then call should instruct the browser to delete the cookie.
 */
export const setSessionTokenCookie = (token: string | undefined) => {
  return doPost('Portal/sessioncookie', { sessionToken: token }, undefined, 'include', DEFAULT_SWC_ENDPOINT)
}
/**
 * Get the current session token from a cookie.  Note that this will only succeed if your app is running on
 * a .synapse.org subdomain.
 */
export const getSessionTokenFromCookie = () => {
  return doGet('Portal/sessioncookie', undefined, 'include', DEFAULT_SWC_ENDPOINT)
}
export const getPrincipalAliasRequest = (sessionToken: string | undefined,
                                         alias: string,
                                         type: string,
                                         endpoint: string = DEFAULT_ENDPOINT) => {
  const url = 'repo/v1/principal/alias'
  return doPost(url, { alias, type }, sessionToken, undefined, endpoint)
}
