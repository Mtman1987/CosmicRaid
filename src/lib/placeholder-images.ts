import placeholderData from './placeholder-images.json';

const images = placeholderData.images;

export function getPlaceholderImage(category: 'space' | 'gaming' | 'tech') {
    const image = images.find(img => img.category === category);
    return image ? image.url : 'https://placehold.co/600x400';
}
