import s from './styles.module.less';
import { MentionItem } from '.';
import COLORS from '@/components/ui/colors';

export function getNode(searchPhrase: string, mentionsList?: MentionItem[]) {
  const listContainer = document.createElement('div');
  listContainer.id = 'list-of-mentions';
  listContainer.classList.add(s.mentionsList);

  const filteredMentions =
    mentionsList
      ?.filter((mentionItem) => mentionItem.label.startsWith(searchPhrase))
      .map((item) => item.label) ?? [];

  filteredMentions.forEach((mention) => {
    const mentionItem = getMentionItem(mention);
    listContainer.appendChild(mentionItem);
  });

  return listContainer;
}

function getMentionItem(mention) {
  const mentionItem = document.createElement('div');
  mentionItem.id = `${mention}`;
  mentionItem.classList.add(s.mentionItem);

  const mentionIcon = getMentionIcon(mention);
  mentionItem.appendChild(mentionIcon);

  const mentionText = getMentionText(mention);
  mentionItem.appendChild(mentionText);

  return mentionItem;
}

function getMentionIcon(mention) {
  const mentionIcon = document.createElement('div');
  mentionIcon.id = `${mention}`;
  const mentionIconText = document.createElement('span');
  const icon = mention[0].toUpperCase();
  const { base, bg } = getIconColor(icon);
  mentionIconText.innerText = icon;
  mentionIcon.style.backgroundColor = bg;
  mentionIcon.style.color = base;
  mentionIcon.classList.add(s.mentionIcon);
  mentionIcon.appendChild(mentionIconText);
  return mentionIcon;
}

function getMentionText(mention) {
  const mentionText = document.createElement('div');
  mentionText.id = `${mention}`;
  mentionText.classList.add(s.mentionText);
  mentionText.innerText = mention;
  return mentionText;
}

function getIconColor(char: string) {
  const colors = [
    {
      base: COLORS.leafGreen.base,
      bg: COLORS.leafGreen.tint,
    },
    {
      base: COLORS.infoColor.base,
      bg: COLORS.infoColor.tint,
    },
    {
      base: COLORS.lightRed.base,
      bg: COLORS.lightRed.tint,
    },
    {
      base: COLORS.turquoise.base,
      bg: COLORS.turquoise.tint,
    },
    {
      base: COLORS.leafGreen.base,
      bg: COLORS.leafGreen.tint,
    },
    {
      base: COLORS.navyBlue.base,
      bg: COLORS.navyBlue.tint,
    },
  ];
  const i = char.charCodeAt(0);
  return colors[i % colors.length];
}

export function sanitizeComment(comment: string): string {
  return comment.replace(/\$\$widget0\s+/g, '').replace(/\$\$/g, '');
}
