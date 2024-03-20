import { SelectedFacet } from '../QueryWrapper/generateEncodedPathAndQueryForSelectedFacetURL'

export type ReleaseCardStat = {
  label: string
  value: string
}

export type StatConfig = {
  // specifies which column should be used to populate the statistic value
  columnName: string
  // the label that will be displayed with the statistic in the card
  label: string
}

export type SelectedFacetConfig = {
  // the column that should be faceted
  facetColumnName: string
  // specifies which column should be used to populate the selected facet value
  facetValueColumnName: string
}

export type ButtonToExplorePageConfig = {
  // button's label
  label: string
  // column name in the data (table, view...) driving the page where the button is located
  // which is used to populate the button's path
  sourcePathColumnName: string
  // column name in the data (table, view...) driving the page where the button is located
  // which is used to populate the defining SQL for the data (table, view...) driving the Explore page
  sourceExploreDataSqlColumnName?: string
  // selected facets used in generating the button's query string,
  // where the selected facet value is looked up in the data (table, view...) driving the page where the button is located:
  //  - facetColumnName: name of the facet column in the data driving the Explore page
  //  - facetValueColumnName: column name in the data driving the page where
  //    the button is located and is used to populate the selected facet value
  selectedFacetConfigs?: SelectedFacetConfig[]
  // selected facets used in generating the button's query string,
  // where the selected facet value is static
  //  - columnName: name of the facet column in the data driving the Explore page
  //  - facetValue: the selected facet value
  staticSelectedFacets?: SelectedFacet[]
}

export type ReleaseMetadataConfig = {
  // specifies which column should be used to populate the release entity id
  releaseEntityColumnName: string
  // specifies which column should be used to populate the release name
  releaseNameColumnName: string
  // specifies which column should be used to populate the release date
  releaseDateColumnName: string
}

type ReleaseCardBaseConfig = {
  releaseMetadataConfig: ReleaseMetadataConfig
  // statistics to display in the release card
  statsConfig: StatConfig[]
}

export type ReleaseCardLargeConfig = ReleaseCardBaseConfig & {
  cardSize: 'large'
  // whether the release version should be prefixed with "Release "
  prependRelease: boolean
  // primary button to explore page
  primaryBtnConfig?: ButtonToExplorePageConfig
  // secondary button to explore page
  secondaryBtnConfig?: ButtonToExplorePageConfig
}

export type ReleaseCardMediumConfig = ReleaseCardBaseConfig & {
  cardSize: 'medium'
  // path to request access to the release data
  requestAccessPath: string
}

export type ReleaseCardConfig = ReleaseCardLargeConfig | ReleaseCardMediumConfig
