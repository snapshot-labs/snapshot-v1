import { useI18n } from 'vue-i18n';
import { useCopy } from '@/composables/useCopy';

export function useShare() {
  const { t } = useI18n();

  const sharingItems = [
    {
      text: 'Twitter',
      action: 'shareToTwitter',
      icon: 'twitter'
    },
    {
      text: 'Facebook',
      action: 'shareToFacebook',
      icon: 'facebook'
    },
    {
      text: t('copyLink'),
      action: 'shareToClipboard',
      icon: 'insertlink'
    }
  ];

  function proposalUrl(key, proposal) {
    return `https://${window.location.hostname}/#/${key}/proposal/${proposal.id}`;
  }
  function encodedProposalUrl(key, proposal) {
    return encodeURIComponent(proposalUrl(key, proposal));
  }

  function shareToTwitter(space, proposal) {
    return `https://twitter.com/intent/tweet?text=@${
      space.twitter || space.name
    }%20${encodeURIComponent(proposal.title)}%20${encodedProposalUrl(
      space.key,
      proposal
    )}`;
  }

  function shareToFacebook(space, proposal) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedProposalUrl(
      space.key,
      proposal
    )}&quote=${encodeURIComponent(proposal.title)}`;
  }

  const { copyToClipboard } = useCopy();

  function shareToClipboard(space, proposal) {
    copyToClipboard(proposalUrl(space.key, proposal));
  }

  return {
    shareToTwitter,
    shareToFacebook,
    shareToClipboard,
    proposalUrl,
    sharingItems
  };
}
