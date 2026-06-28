import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import {
  Box,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteGeneration, listGenerations } from '../api/generations';
import { Generation } from '../types';

export default function GalleryPage() {
  const [lightbox, setLightbox] = useState<Generation | null>(null);
  const queryClient = useQueryClient();

  const { data: generations, isLoading } = useQuery({
    queryKey: ['generations'],
    queryFn: () => listGenerations(100, 0),
  });

  const { mutate: remove } = useMutation({
    mutationFn: deleteGeneration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['generations'] }),
  });

  const completed = (generations ?? []).filter((g) => g.status === 'completed');

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Gallery
        <Typography component="span" variant="h5" color="text.secondary" fontWeight={400}>
          {' '}
          · {completed.length} image{completed.length !== 1 ? 's' : ''}
        </Typography>
      </Typography>

      {isLoading && (
        <Box display="flex" justifyContent="center" p={10}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && completed.length === 0 && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          p={10}
          gap={1}
          sx={{ opacity: 0.4 }}
        >
          <Typography variant="h6">No images yet</Typography>
          <Typography variant="body2">
            Head to Generate to create your first image.
          </Typography>
        </Box>
      )}

      {completed.length > 0 && (
        <ImageList variant="masonry" cols={3} gap={12}>
          {completed.map((gen) => (
            <ImageListItem
              key={gen.id}
              sx={{ cursor: 'pointer', '&:hover .item-bar': { opacity: 1 } }}
            >
              <img
                src={gen.image_url!}
                alt={gen.prompt}
                loading="lazy"
                style={{ borderRadius: 10, display: 'block' }}
                onClick={() => setLightbox(gen)}
              />
              <ImageListItemBar
                className="item-bar"
                title={
                  <Typography variant="caption" noWrap>
                    {gen.prompt}
                  </Typography>
                }
                subtitle={
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    <Chip label={gen.model} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                    <Chip
                      label={gen.aspect_ratio}
                      size="small"
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  </Box>
                }
                actionIcon={
                  <Box sx={{ display: 'flex' }}>
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => setLightbox(gen)} sx={{ color: 'white' }}>
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        component="a"
                        href={gen.image_url!}
                        download
                        sx={{ color: 'white' }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => remove(gen.id)}
                        sx={{ color: 'error.light' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
                sx={{ opacity: 0, transition: 'opacity 0.2s', borderRadius: '0 0 10px 10px' }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}

      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        maxWidth={false}
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
      >
        <DialogContent sx={{ p: 0 }} onClick={() => setLightbox(null)}>
          {lightbox?.image_url && (
            <img
              src={lightbox.image_url}
              alt={lightbox.prompt}
              style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block', borderRadius: 12 }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
