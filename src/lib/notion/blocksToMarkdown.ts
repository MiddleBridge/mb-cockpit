/**
 * Convert Notion blocks to Markdown
 * Supports common block types and rich text annotations
 */

import { NotionBlock } from './client';

export interface RichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  mention?: any;
  equation?: { expression: string };
  annotations: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text: string;
  href?: string | null;
}

/**
 * Convert rich text array to markdown string
 */
function richTextToMarkdown(richText: RichText[]): string {
  if (!richText || richText.length === 0) {
    return '';
  }
  
  return richText.map(rt => {
    let text = rt.plain_text || '';
    
    // Apply annotations (order matters for nested formatting)
    if (rt.annotations.code) {
      text = `\`${text}\``;
    }
    if (rt.annotations.bold) {
      text = `**${text}**`;
    }
    if (rt.annotations.italic) {
      text = `*${text}*`;
    }
    if (rt.annotations.strikethrough) {
      text = `~~${text}~~`;
    }
    if (rt.annotations.underline) {
      // Markdown doesn't have underline, use HTML
      text = `<u>${text}</u>`;
    }
    
    // Handle links
    if (rt.href || rt.text?.link?.url) {
      const url = rt.href || rt.text?.link?.url || '';
      text = `[${text}](${url})`;
    }
    
    return text;
  }).join('');
}

/**
 * Convert a single block to markdown
 */
function blockToMarkdown(block: NotionBlock, indent: number = 0): string {
  const indentStr = '  '.repeat(indent);
  const type = block.type;
  
  switch (type) {
    case 'paragraph': {
      const richText = (block.paragraph as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      return text ? `${indentStr}${text}\n` : '';
    }
    
    case 'heading_1': {
      const richText = (block.heading_1 as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      return text ? `${indentStr}# ${text}\n` : '';
    }
    
    case 'heading_2': {
      const richText = (block.heading_2 as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      return text ? `${indentStr}## ${text}\n` : '';
    }
    
    case 'heading_3': {
      const richText = (block.heading_3 as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      return text ? `${indentStr}### ${text}\n` : '';
    }
    
    case 'bulleted_list_item': {
      const richText = (block.bulleted_list_item as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      let result = `${indentStr}- ${text}\n`;
      
      // Handle children (nested lists)
      if (block.has_children && (block as any).children) {
        const children = (block as any).children as NotionBlock[];
        children.forEach(child => {
          result += blockToMarkdown(child, indent + 1);
        });
      }
      
      return result;
    }
    
    case 'numbered_list_item': {
      const richText = (block.numbered_list_item as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      let result = `${indentStr}1. ${text}\n`;
      
      // Handle children
      if (block.has_children && (block as any).children) {
        const children = (block as any).children as NotionBlock[];
        children.forEach(child => {
          result += blockToMarkdown(child, indent + 1);
        });
      }
      
      return result;
    }
    
    case 'to_do': {
      const toDo = block.to_do as any;
      const checked = toDo?.checked || false;
      const richText = toDo?.rich_text || [];
      const text = richTextToMarkdown(richText);
      const checkbox = checked ? '[x]' : '[ ]';
      return `${indentStr}${checkbox} ${text}\n`;
    }
    
    case 'toggle': {
      const toggle = block.toggle as any;
      const richText = toggle?.rich_text || [];
      const text = richTextToMarkdown(richText);
      let result = `${indentStr}<details>\n${indentStr}<summary>${text}</summary>\n`;
      
      // Handle children
      if (block.has_children && (block as any).children) {
        const children = (block as any).children as NotionBlock[];
        children.forEach(child => {
          result += blockToMarkdown(child, indent + 1);
        });
      }
      
      result += `${indentStr}</details>\n`;
      return result;
    }
    
    case 'quote': {
      const richText = (block.quote as any)?.rich_text || [];
      const text = richTextToMarkdown(richText);
      return text ? `${indentStr}> ${text.replace(/\n/g, '\n> ')}\n` : '';
    }
    
    case 'callout': {
      const callout = block.callout as any;
      const richText = callout?.rich_text || [];
      const text = richTextToMarkdown(richText);
      const icon = callout?.icon?.emoji || '💡';
      return text ? `${indentStr}> ${icon} ${text.replace(/\n/g, '\n> ')}\n` : '';
    }
    
    case 'code': {
      const code = block.code as any;
      const richText = code?.rich_text || [];
      const text = richTextToMarkdown(richText);
      const language = code?.language || '';
      return text ? `${indentStr}\`\`\`${language}\n${text}\n\`\`\`\n` : '';
    }
    
    case 'divider': {
      return `${indentStr}---\n`;
    }
    
    case 'child_page': {
      const childPage = block.child_page as any;
      const title = childPage?.title || 'Untitled';
      return `${indentStr}[${title}](notion://${block.id})\n`;
    }
    
    case 'unsupported': {
      return `${indentStr}<!-- Unsupported block type -->\n`;
    }
    
    default: {
      // Try to extract any rich_text from unknown block types
      const blockData = (block as any)[type];
      if (blockData?.rich_text) {
        const text = richTextToMarkdown(blockData.rich_text);
        return text ? `${indentStr}${text}\n` : '';
      }
      
      return `${indentStr}<!-- Block type: ${type} -->\n`;
    }
  }
}

/**
 * Convert blocks array to markdown
 * Handles nested blocks recursively
 */
export async function blocksToMarkdown(
  blocks: NotionBlock[],
  fetchChildren?: (blockId: string) => Promise<NotionBlock[]>
): Promise<{ markdown: string; plaintext: string }> {
  let markdown = '';
  
  // Process blocks and fetch children if needed
  for (const block of blocks) {
    // If block has children and we have a fetch function, fetch them
    if (block.has_children && fetchChildren) {
      try {
        const children = await fetchChildren(block.id);
        (block as any).children = children;
      } catch (error) {
        console.warn(`Failed to fetch children for block ${block.id}:`, error);
      }
    }
    
    markdown += blockToMarkdown(block);
  }
  
  // Generate plaintext by stripping markdown
  const plaintext = markdown
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/^>\s+/gm, '') // Remove quote markers
    .replace(/^\[([ x])\]\s+/gm, '') // Remove checkbox markers
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
  
  return { markdown, plaintext };
}

/**
 * Extract title from page properties
 */
export function extractPageTitle(page: any): string {
  if (!page.properties) {
    return 'Untitled';
  }
  
  // Try common title property names
  const titleKeys = ['title', 'Name', 'name', 'Title'];
  
  for (const key of titleKeys) {
    const prop = page.properties[key];
    if (prop?.type === 'title' && prop.title?.length > 0) {
      return prop.title.map((rt: RichText) => rt.plain_text).join('');
    }
  }
  
  // Fallback: use first property with title type
  for (const [key, prop] of Object.entries(page.properties)) {
    if ((prop as any)?.type === 'title' && (prop as any).title?.length > 0) {
      return (prop as any).title.map((rt: RichText) => rt.plain_text).join('');
    }
  }
  
  return 'Untitled';
}

