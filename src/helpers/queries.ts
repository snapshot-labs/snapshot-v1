import gql from 'graphql-tag';

export const VOTES_QUERY = gql`
  query Votes(
    $id: String!
    $first: Int
    $skip: Int
    $orderBy: String
    $orderDirection: OrderDirection
    $reason_not: String
    $voter: String
    $space: String
    $created_gte: Int
  ) {
    votes(
      first: $first
      skip: $skip
      where: {
        proposal: $id
        vp_gt: 0
        voter: $voter
        space: $space
        reason_not: $reason_not
        created_gte: $created_gte
      }
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ipfs
      voter
      choice
      vp
      vp_by_strategy
      reason
      created
    }
  }
`;

export const PROPOSAL_QUERY = gql`
  query Proposal($id: String!) {
    proposal(id: $id) {
      id
      ipfs
      title
      body
      discussion
      choices
      labels
      start
      end
      snapshot
      state
      author
      created
      plugins
      network
      type
      quorum
      quorumType
      symbol
      privacy
      validation {
        name
        params
      }
      strategies {
        name
        network
        params
      }
      space {
        id
        name
      }
      scores_state
      scores
      scores_by_strategy
      scores_total
      votes
      flagged
    }
  }
`;

export const PROPOSALS_QUERY = gql`
  query Proposals(
    $first: Int!
    $skip: Int!
    $state: String!
    $space: String
    $space_in: [String]
    $author_in: [String]
    $title_contains: String
    $space_verified: Boolean
    $flagged: Boolean
  ) {
    proposals(
      first: $first
      skip: $skip
      where: {
        space: $space
        state: $state
        space_in: $space_in
        author_in: $author_in
        title_contains: $title_contains
        space_verified: $space_verified
        flagged: $flagged
      }
    ) {
      id
      ipfs
      title
      body
      start
      end
      state
      author
      created
      choices
      space {
        id
        name
        members
        avatar
        symbol
        verified
        turbo
        plugins
      }
      scores_state
      scores_total
      scores
      votes
      quorum
      quorumType
      symbol
      flagged
    }
  }
`;

export const NOTIFICATION_PROPOSALS_QUERY = gql`
  query Proposals(
    $first: Int!
    $state: String!
    $space_in: [String]
    $start_gte: Int
  ) {
    proposals(
      first: $first
      where: { state: $state, space_in: $space_in, start_gte: $start_gte }
    ) {
      id
      title
      start
      end
      state
      space {
        id
        name
        avatar
      }
    }
  }
`;

export const FOLLOWS_QUERY = gql`
  query Follows($space_in: [String], $follower_in: [String]) {
    follows(
      where: { space_in: $space_in, follower_in: $follower_in }
      first: 500
    ) {
      id
      follower
      space {
        id
      }
    }
  }
`;

export const SUBSCRIPTIONS_QUERY = gql`
  query Subscriptions($space: String, $address: String) {
    subscriptions(where: { space: $space, address: $address }) {
      id
      address
      space {
        id
      }
    }
  }
`;

export const ALIASES_QUERY = gql`
  query Aliases($address: String!, $alias: String!, $created_gt: Int) {
    aliases(
      where: { address: $address, alias: $alias, created_gt: $created_gt }
    ) {
      address
      alias
    }
  }
`;

export const ENS_DOMAINS_BY_ACCOUNT_QUERY = gql`
  query Domain($id: String!) {
    account(id: $id) {
      domains {
        name
        expiryDate
      }
      wrappedDomains {
        name
        expiryDate
      }
    }
  }
`;

export const ENS_DOMAIN_BY_HASH_QUERY = gql`
  query Registration($id: String!) {
    registration(id: $id) {
      domain {
        name
        labelName
      }
    }
  }
`;

export const SPACE_SKIN_QUERY = gql`
  query Space($id: String!) {
    space(id: $id) {
      skin
    }
  }
`;

export const SPACE_DELEGATE_QUERY = gql`
  query Space($id: String!) {
    space(id: $id) {
      id
      symbol
      network
      strategies {
        name
        network
        params
      }
    }
  }
`;

export const SKINS_COUNT_QUERY = gql`
  query Skins {
    skins {
      id
      spacesCount
    }
  }
`;

export const NETWORKS_COUNT_QUERY = gql`
  query Networks {
    networks {
      id
      spacesCount
    }
  }
`;

export const PLUGINS_COUNT_QUERY = gql`
  query Plugins {
    plugins {
      id
      spacesCount
    }
  }
`;

export const VALIDATIONS_COUNT_QUERY = gql`
  query Validations {
    validations {
      id
      spacesCount
    }
  }
`;

export const STRATEGIES_QUERY = gql`
  query Strategies {
    strategies {
      id
      author
      version
      spacesCount
    }
  }
`;

export const EXTENDED_STRATEGY_QUERY = gql`
  query Strategy($id: String!) {
    strategy(id: $id) {
      id
      author
      version
      spacesCount
      about
      schema
      examples
    }
  }
`;

export const ACTIVITY_VOTES_QUERY = gql`
  query Votes(
    $voter: String!
    $first: Int
    $skip: Int
    $orderBy: String
    $orderDirection: OrderDirection
  ) {
    votes(
      first: $first
      skip: $skip
      where: { voter: $voter }
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      created
      choice
      proposal {
        id
        title
        choices
        type
      }
      space {
        id
        avatar
      }
    }
  }
`;

export const PROFILES_QUERY = gql`
  query Users($addresses: [String]!, $first: Int, $skip: Int) {
    users(first: $first, skip: $skip, where: { id_in: $addresses }) {
      id
      name
      about
      avatar
      created
    }
  }
`;

export const USER_VOTED_PROPOSAL_IDS_QUERY = gql`
  query Votes($voter: String!, $proposals: [String]!) {
    votes(first: 1000, where: { voter: $voter, proposal_in: $proposals }) {
      proposal {
        id
      }
    }
  }
`;

export const SPACES_RANKING_QUERY = gql`
  query Ranking(
    $first: Int
    $skip: Int
    $search: String
    $network: String
    $category: String
  ) {
    ranking(
      first: $first
      skip: $skip
      where: { search: $search, network: $network, category: $category }
    ) {
      metrics {
        total
        categories
      }
      items {
        id
        name
        avatar
        private
        verified
        turbo
        categories
        rank
        activeProposals
        proposalsCount
        proposalsCount7d
        followersCount
        followersCount7d
        votesCount
        votesCount7d
        terms
      }
    }
  }
`;

export const SPACES_QUERY = gql`
  query Spaces($id_in: [String], $first: Int, $skip: Int) {
    spaces(first: $first, skip: $skip, where: { id_in: $id_in }) {
      id
      name
      avatar
      verified
      turbo
      activeProposals
      followersCount
      terms
      flagged
      hibernated
    }
  }
`;

export const STATEMENTS_QUERY = gql`
  query Statements($space: String!, $delegate_in: [String]!) {
    statements(where: { space: $space, delegate_in: $delegate_in }) {
      delegate
      space
      statement
      about
      ipfs
      id
      discourse
      network
      status
    }
  }
`;

export const SPACE_QUERY = gql`
  query Space($id: String!) {
    space(id: $id) {
      id
      name
      about
      network
      symbol
      network
      terms
      skin
      avatar
      twitter
      website
      github
      coingecko
      private
      domain
      admins
      moderators
      members
      categories
      labels {
        id
        name
        description
        color
      }
      plugins
      followersCount
      template
      guidelines
      verified
      turbo
      flagged
      hibernated
      parent {
        id
        name
        avatar
        followersCount
        children {
          id
        }
      }
      children {
        id
        name
        avatar
        followersCount
        parent {
          id
        }
      }
      voting {
        delay
        period
        type
        quorum
        quorumType
        privacy
        hideAbstain
      }
      strategies {
        name
        network
        params
      }
      validation {
        name
        params
      }
      voteValidation {
        name
        params
      }
      filters {
        minScore
        onlyMembers
      }
      delegationPortal {
        delegationType
        delegationContract
        delegationNetwork
        delegationApi
      }
      treasuries {
        name
        address
        network
      }
      boost {
        enabled
        bribeEnabled
      }
    }
  }
`;

export const LEADERBOARD_QUERY = gql`
  query Leaderboard($space: String!, $user_in: [String]) {
    leaderboards(where: { space: $space, user_in: $user_in }) {
      space
      user
      proposalsCount
      votesCount
      lastVote
    }
  }
`;
