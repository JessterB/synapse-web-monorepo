import { act, renderHook } from '@testing-library/react'
import { cloneDeep } from 'lodash-es'
import useImmutableTableQuery, {
  DEBOUNCE_DELAY_MS,
  UseImmutableTableQueryOptions,
} from './useImmutableTableQuery'
import * as DeepLinkingUtils from '../../functions/deepLinkingUtils'
import {
  ColumnSingleValueFilterOperator,
  QueryBundleRequest,
} from '@sage-bionetworks/synapse-types'

const options: UseImmutableTableQueryOptions = {
  initQueryRequest: {
    concreteType: 'org.sagebionetworks.repo.model.table.QueryBundleRequest',
    entityId: 'syn123',
    partMask: 1,
    query: {
      sql: 'SELECT * FROM syn123.3 WHERE "foo"=\'bar\'',
    },
  },
  requireConfirmationOnChange: false,
}

const initialQueryWithFacet: QueryBundleRequest = {
  ...options.initQueryRequest,
  query: {
    ...options.initQueryRequest.query,
    selectedFacets: [
      {
        columnName: 'foo',
        concreteType:
          'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
        facetValues: ['bar', 'baz'],
      },
    ],
  },
}

const initialQueryWithFilter: QueryBundleRequest = {
  ...options.initQueryRequest,
  query: {
    ...options.initQueryRequest.query,
    additionalFilters: [
      {
        columnName: 'foo',
        concreteType:
          'org.sagebionetworks.repo.model.table.ColumnSingleValueQueryFilter',
        values: ['bar', 'baz'],
        operator: ColumnSingleValueFilterOperator.EQUAL,
      },
    ],
  },
}

describe('useImmutableTableQuery tests', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('Returns the entity ID and version in the passed query', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.entityId).toEqual('syn123')
    expect(result.current.versionNumber).toEqual(3)
  })

  it('Updates the query using a new query object', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.getCurrentQueryRequest()).toEqual(
      options.initQueryRequest,
    )

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test
    act(() => {
      result.current.setQuery(newQuery)
    })
    expect(result.current.getCurrentQueryRequest()).toEqual(newQuery)
  })

  it('Updates the query using a transformer function', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.getCurrentQueryRequest()).toEqual(
      options.initQueryRequest,
    )

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test
    act(() => {
      result.current.setQuery(currentQuery => {
        currentQuery.query.sql = newQuery.query.sql
        return currentQuery
      })
    })
    expect(result.current.getCurrentQueryRequest()).toEqual(newQuery)
  })

  it('Returns a deep clone of the initial request', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.getInitQueryRequest()).toEqual(
      options.initQueryRequest,
    )
    expect(result.current.getInitQueryRequest()).not.toBe(
      options.initQueryRequest,
    )
  })

  it('Returns a deep clone of the most recent request', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.getCurrentQueryRequest()).toEqual(
      options.initQueryRequest,
    )
    expect(result.current.getCurrentQueryRequest()).not.toBe(
      options.initQueryRequest,
    )
  })

  it('Updates the page size', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    expect(result.current.pageSize).toEqual(25)

    // Call under test
    act(() => {
      result.current.setPageSize(50)
    })

    expect(result.current.pageSize).toEqual(50)
    expect(result.current.getCurrentQueryRequest().query.limit).toEqual(50)
  })

  it('Updates the page number', () => {
    const { result } = renderHook(() => useImmutableTableQuery(options))
    const pageSize = result.current.pageSize
    expect(result.current.currentPage).toEqual(1)

    // Call under test
    act(() => {
      result.current.goToPage(2)
    })

    expect(result.current.currentPage).toEqual(2)
    expect(result.current.getCurrentQueryRequest().query.offset).toEqual(
      pageSize,
    )
  })

  it('Calls onQueryChange when the query is modified', () => {
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery)
    })
    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))
  })

  it('Updates the query if initQueryRequest changes', () => {
    const onQueryChange = jest.fn()
    const { rerender } = renderHook(props => useImmutableTableQuery(props), {
      initialProps: { ...options, onQueryChange },
    })

    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the initQueryRequest
    rerender({
      ...options,
      onQueryChange,
      initQueryRequest: newQuery,
    })

    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))
  })

  it('Updates the URL if shouldDeepLink is true', () => {
    const mockUpdateUrl = jest
      .spyOn(DeepLinkingUtils, 'updateUrlWithNewSearchParam')
      .mockImplementation(() => {})
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        shouldDeepLink: true,
        componentIndex: 4,
      }),
    )

    // called with `null`, which would remove the query parameter, if it exists
    expect(mockUpdateUrl).toHaveBeenCalledWith('QueryWrapper', 4, null)

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery)
    })
    expect(mockUpdateUrl).toHaveBeenCalledWith(
      'QueryWrapper',
      4,
      JSON.stringify(newQuery.query),
    )

    // Change the query back to the initial query, and the parameter should be removed
    act(() => {
      result.current.setQuery(options.initQueryRequest)
    })
    expect(mockUpdateUrl).toHaveBeenLastCalledWith('QueryWrapper', 4, null)
  })

  it('Updates the query on mount one is found in the URL', () => {
    const sqlInURL = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''
    const mockUpdateUrl = jest
      .spyOn(DeepLinkingUtils, 'getQueryRequestFromLink')
      .mockImplementation(() => {
        return {
          ...options.initQueryRequest,
          query: {
            sql: sqlInURL,
          },
        }
      })
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        shouldDeepLink: true,
        componentIndex: 4,
      }),
    )

    expect(mockUpdateUrl).toHaveBeenCalledTimes(1)

    expect(result.current.getCurrentQueryRequest().query.sql).toEqual(sqlInURL)
  })

  it('onConfirmChange works when required', () => {
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
        requireConfirmationOnChange: true,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(result.current.isConfirmingChange).toBe(false)

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery)
    })

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(result.current.isConfirmingChange).toBe(true)

    // Call under test - confirm the change
    act(() => {
      result.current.onConfirmChange()
    })

    expect(result.current.isConfirmingChange).toBe(false)
    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))
  })

  it('onCancelChange works when confirmation is required', () => {
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
        requireConfirmationOnChange: true,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(result.current.isConfirmingChange).toBe(false)

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery)
    })

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(result.current.isConfirmingChange).toBe(true)

    // Call under test - cancel the change
    act(() => {
      result.current.onCancelChange()
    })

    expect(result.current.isConfirmingChange).toBe(false)
    expect(onQueryChange).not.toHaveBeenCalled()
  })

  it('does not trigger required confirmation if only pagination parameters change', () => {
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
        requireConfirmationOnChange: true,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()
    expect(result.current.isConfirmingChange).toBe(false)

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.limit = 5
    newQuery.query.offset = 50

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery)
    })

    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))
    expect(result.current.isConfirmingChange).toBe(false)
  })

  test('addValueToSelectedFacet when facet does not exist', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test - add value to new facet
    act(() => {
      result.current.addValueToSelectedFacet('abc', 'def')
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        selectedFacets: [
          ...initQueryRequest.query.selectedFacets!,
          {
            columnName: 'abc',
            concreteType:
              'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
            facetValues: ['def'],
          },
        ],
      },
    })
  })
  test('addValueToSelectedFacet when facet exists', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test - add new value to existing facet
    act(() => {
      result.current.addValueToSelectedFacet('foo', 'qux')
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        selectedFacets: [
          {
            columnName: 'foo',
            concreteType:
              'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
            facetValues: ['bar', 'baz', 'qux'],
          },
        ],
      },
    })
  })

  test('addValueToSelectedFacet when facet value is already present', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test
    act(() => {
      result.current.addValueToSelectedFacet('foo', 'bar')
    })

    // Should not have changed
    expect(result.current.currentQueryRequest).toEqual(initQueryRequest)
  })

  test('removeSelectedFacet when facet exists', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test
    act(() => {
      result.current.removeSelectedFacet(
        result.current.getCurrentQueryRequest().query.selectedFacets![0],
      )
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        selectedFacets: undefined,
      },
    })
  })
  test('removeSelectedFacet when facet does not exist', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test
    act(() => {
      result.current.removeSelectedFacet({
        columnName: 'abc',
        facetValues: ['def'],
        concreteType:
          'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
      })
    })

    expect(result.current.currentQueryRequest).toEqual(initQueryRequest)
  })

  test('removeValueFromSelectedFacet when facet has multiple values', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test - remove value
    act(() => {
      result.current.removeValueFromSelectedFacet('foo', 'bar')
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        selectedFacets: [
          {
            columnName: 'foo',
            facetValues: ['baz'],
            concreteType:
              'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
          },
        ],
      },
    })
  })

  test('removeValueFromSelectedFacet when removing last value in facet', () => {
    const initQueryRequest: QueryBundleRequest = {
      ...initialQueryWithFacet,
      query: {
        ...initialQueryWithFacet.query,
        selectedFacets: [
          {
            columnName: 'foo',
            // only one value left
            facetValues: ['bar'],
            concreteType:
              'org.sagebionetworks.repo.model.table.FacetColumnValuesRequest',
          },
        ],
      },
    }

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    // Call under test - remove all values
    act(() => {
      result.current.removeValueFromSelectedFacet('foo', 'bar')
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        selectedFacets: undefined,
      },
    })
  })
  test("removeValueFromSelectedFacet when facet doesn't exist", () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFacet

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    act(() => {
      result.current.removeValueFromSelectedFacet('abc', 'def')
    })

    expect(result.current.currentQueryRequest).toEqual(initQueryRequest)
  })

  test('removeQueryFilter', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFilter

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    act(() => {
      result.current.removeQueryFilter(
        result.current.getCurrentQueryRequest().query.additionalFilters![0],
      )
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        additionalFilters: undefined,
      },
    })
  })

  test('removeValueFromQueryFilter when filter has multiple values', () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFilter

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    act(() => {
      result.current.removeValueFromQueryFilter(
        result.current.getCurrentQueryRequest().query.additionalFilters![0],
        'bar',
      )
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        additionalFilters: [
          {
            columnName: 'foo',
            values: ['baz'],
            operator: ColumnSingleValueFilterOperator.EQUAL,
            concreteType:
              'org.sagebionetworks.repo.model.table.ColumnSingleValueQueryFilter',
          },
        ],
      },
    })
  })
  test('removeValueFromQueryFilter when removing last value in filter', () => {
    const initQueryRequest: QueryBundleRequest = {
      ...initialQueryWithFilter,
      query: {
        ...initialQueryWithFilter.query,
        additionalFilters: [
          {
            columnName: 'foo',
            values: ['bar'],
            operator: ColumnSingleValueFilterOperator.EQUAL,
            concreteType:
              'org.sagebionetworks.repo.model.table.ColumnSingleValueQueryFilter',
          },
        ],
      },
    }

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    act(() => {
      result.current.removeValueFromQueryFilter(
        result.current.getCurrentQueryRequest().query.additionalFilters![0],
        'bar',
      )
    })

    expect(result.current.currentQueryRequest).toEqual({
      ...initQueryRequest,
      query: {
        ...initQueryRequest.query,
        additionalFilters: undefined,
      },
    })
  })
  test("removeValueFromQueryFilter when filter doesn't exist", () => {
    const initQueryRequest: QueryBundleRequest = initialQueryWithFilter

    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        initQueryRequest: initQueryRequest,
      }),
    )

    act(() => {
      result.current.removeValueFromQueryFilter(
        {
          columnName: 'abc',
          values: ['def'],
          operator: ColumnSingleValueFilterOperator.EQUAL,
          concreteType:
            'org.sagebionetworks.repo.model.table.ColumnSingleValueQueryFilter',
        },
        'def',
      )
    })

    expect(result.current.currentQueryRequest).toEqual(initQueryRequest)
  })

  it('delays committing one change with debounce delay', () => {
    jest.useFakeTimers()
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery, { debounce: true })
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_DELAY_MS)
    })
    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))

    jest.useRealTimers()
  })

  it('delays committing multiple changes with debounce delay', () => {
    jest.useFakeTimers()
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery, { debounce: true })
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2)
    })
    // Still should not have been committed
    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery2 = cloneDeep(options.initQueryRequest)
    newQuery2.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'qux\''

    act(() => {
      result.current.setQuery(newQuery2, { debounce: true })
    })
    // Timer is reset, so advancing again by half the delay should not commit
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2)
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    // Finish the timer
    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2)
    })

    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery2.query))

    jest.useRealTimers()
  })

  it('commits changes only when explicitly committed when noCommit', () => {
    jest.useFakeTimers()
    const onQueryChange = jest.fn()
    const { result } = renderHook(() =>
      useImmutableTableQuery({
        ...options,
        onQueryChange,
      }),
    )

    expect(onQueryChange).not.toHaveBeenCalled()

    const newQuery = cloneDeep(options.initQueryRequest)
    newQuery.query.sql = 'SELECT * FROM syn123.3 WHERE "foo"=\'baz\''

    // Call under test - change the query
    act(() => {
      result.current.setQuery(newQuery, { noCommit: true })
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    // Call under test - commit the query
    act(() => {
      result.current.commitChanges()
    })
    expect(onQueryChange).toHaveBeenCalledWith(JSON.stringify(newQuery.query))

    jest.useRealTimers()
  })
})
