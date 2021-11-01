import { library } from '@fortawesome/fontawesome-svg-core'
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Collapse } from '@material-ui/core'
import React, { useEffect, useRef, useState } from 'react'
import { TextMatchesQueryFilter } from '../utils/synapseTypes/Table/QueryFilter'
import {
  QueryWrapperChildProps,
  QUERY_FILTERS_COLLAPSED_CSS,
  QUERY_FILTERS_EXPANDED_CSS,
} from './QueryWrapper'

library.add(faSearch)
library.add(faTimes)

type InternalSearchProps = QueryWrapperChildProps

// See https://sagebionetworks.jira.com/browse/PLFM-7011
const MIN_SEARCH_QUERY_LENGTH = 3

function FullTextSearch(props: InternalSearchProps) {
  const [searchText, setSearchText] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const showSearchBar = props?.topLevelControlsState?.showSearchBar

  useEffect(() => {
    if (showSearchBar) {
      searchInputRef.current?.focus()
    }
  }, [showSearchBar])

  const search = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    // The HTML validation doesn't trim the string, so we add an extra check.
    // We don't auto-trim the form text ourselves because the user may still be focused on the input.
    if (searchText.trim().length < MIN_SEARCH_QUERY_LENGTH) {
      searchInputRef.current?.setCustomValidity(
        `Search term must have a minimum of ${MIN_SEARCH_QUERY_LENGTH} characters`,
      )
    } else {
      const { executeQueryRequest, getLastQueryRequest } = props

      const lastQueryRequestDeepClone = getLastQueryRequest!()

      const { additionalFilters = [] } = lastQueryRequestDeepClone.query

      const textMatchesQueryFilter: TextMatchesQueryFilter = {
        concreteType:
          'org.sagebionetworks.repo.model.table.TextMatchesQueryFilter',
        searchExpression: searchText,
      }
      additionalFilters.push(textMatchesQueryFilter)

      lastQueryRequestDeepClone.query.additionalFilters = additionalFilters
      executeQueryRequest!(lastQueryRequestDeepClone)
    }
  }

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    searchInputRef.current?.setCustomValidity('')
    setSearchText(event.currentTarget.value)
  }

  const { topLevelControlsState } = props

  const showFacetFilter = topLevelControlsState?.showFacetFilter
  return (
    <div
      className={`SearchV2 ${
        showFacetFilter
          ? QUERY_FILTERS_EXPANDED_CSS
          : QUERY_FILTERS_COLLAPSED_CSS
      }`}
    >
      <Collapse
        in={topLevelControlsState?.showSearchBar}
        timeout={{ enter: 300, exit: 300 }}
      >
        <form className="SearchV2__searchbar" onSubmit={search}>
          <FontAwesomeIcon
            className="SearchV2__searchbar__searchicon"
            size={'sm'}
            icon={'search'}
          />
          <input
            ref={searchInputRef}
            minLength={MIN_SEARCH_QUERY_LENGTH}
            onChange={handleChange}
            placeholder="Enter Search Terms"
            value={searchText}
            type="text"
          />
          {searchText.length > 0 && (
            <button
              className="SearchV2__searchbar__clearbutton"
              type="button"
              onClick={() => {
                setSearchText('')
              }}
            >
              <FontAwesomeIcon
                className="SRC-primary-text-color"
                icon="times"
              />
            </button>
          )}
        </form>
      </Collapse>
    </div>
  )
}

export default FullTextSearch
